import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/session";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";
import fs from "fs";

// Initialize Service Provider
const sp = getServiceProvider();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;
    const rawRelayState = formData.get("RelayState") as string | null;

    if (!samlResponse) {
      return NextResponse.redirect(new URL("/?error=no_response", req.url));
    }

    // Clean relayState immediately - take only the first part if comma-separated
    let relayState: string | null = null;
    if (rawRelayState) {
      const cleaned = rawRelayState.trim().split(',')[0].trim();
      if (cleaned.startsWith('/')) {
        relayState = cleaned;
      }
    }

    // Get IdP dynamically to ensure it's fresh
    const idp = getIdentityProvider();
    
    // Check if certificate is invalid (causes infinite loops)
    const hasEntryPoint = !!process.env.OKTA_ENTRY_POINT;
    const certPath = `${process.cwd()}/okta-cert.pem`;
    const envCertExists = !!process.env.OKTA_CERT && process.env.OKTA_CERT.trim().length > 0;
    const certFileExists = fs.existsSync(certPath);
    
    // If we have entry point but no IdP, certificate is definitely invalid
    if (hasEntryPoint && !idp) {
      return NextResponse.redirect(new URL("/?error=invalid_certificate", req.url));
    }
    
    // Development bypass: If enabled and no IdP, redirect to secure with mock session
    const devBypass = process.env.ENABLE_DEV_BYPASS === "true";
    if (!idp) {
      if (devBypass) {
        const baseUrl = new URL(req.url).origin;
        const finalUrl = `${baseUrl}/secure`;
        const response = NextResponse.redirect(finalUrl);
        await setSession(req as any, response as any, {
          nameID: "dev-user@example.com",
          email: "dev-user@example.com",
          firstName: "Dev",
          lastName: "User",
          attributes: {},
        });
        return response;
      }
      return NextResponse.redirect(new URL("/?error=idp_not_configured", req.url));
    }

    // Parse and validate SAML response
    let extract: any;
    try {
      const parseResult = await sp.parseLoginResponse(idp, "post", {
        body: {
          SAMLResponse: samlResponse,
          RelayState: relayState || undefined,
        },
      });
      extract = parseResult.extract;
    } catch (parseError: any) {
      // Check if it's a certificate/signature issue
      if (parseError.message?.includes("map") || parseError.message?.includes("null")) {
        return NextResponse.redirect(new URL("/?error=certificate_verification_failed", req.url));
      }
      throw parseError;
    }

    // Extract user information from SAML assertion
    // IMPORTANT: Store sessionIndex for Single Logout (SLO)
    // sessionIndex might be an object or a string - extract the actual value
    let sessionIndexValue: any = extract.response.sessionIndex || extract.sessionIndex || null;
    // If it's an object, extract the sessionIndex property
    if (sessionIndexValue && typeof sessionIndexValue === 'object' && sessionIndexValue.sessionIndex) {
      sessionIndexValue = sessionIndexValue.sessionIndex;
    }
    
    const userInfo = {
      nameID: extract.response.nameID || extract.response.nameId || extract.nameID,
      attributes: extract.response.attributes || extract.attributes || {},
      sessionIndex: sessionIndexValue,
      issuer: extract.response.issuer || extract.issuer,
      email: extract.response.attributes?.email || 
             extract.response.attributes?.Email || 
             extract.response.attributes?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
             extract.attributes?.email ||
             extract.nameID,
      firstName: extract.response.attributes?.firstName || 
                 extract.response.attributes?.FirstName ||
                 extract.response.attributes?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"] ||
                 extract.attributes?.firstName,
      lastName: extract.response.attributes?.lastName || 
                extract.response.attributes?.LastName ||
                extract.response.attributes?.["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"] ||
                extract.attributes?.lastName,
      allAttributes: extract.response.attributes || extract.attributes || {},
    };

    // Use relayState if provided, otherwise default to /secure
    const redirectPath = relayState || "/secure";
    const currentUrl = new URL(req.url);
    const redirectUrl = new URL(redirectPath, `${currentUrl.protocol}//${currentUrl.host}`);
    
    // Create response and set session
    const response = NextResponse.redirect(redirectUrl.toString(), { status: 302 });
    await setSession(req as any, response as any, userInfo);

    return response;
  } catch (error: any) {
    const errorMessage = error.message || "saml_error";
    let errorCode = "saml_error";
    
    if (errorMessage.includes("429") || errorMessage.includes("Too Many Requests")) {
      errorCode = "rate_limit";
    } else if (errorMessage.includes("certificate") || errorMessage.includes("signature")) {
      errorCode = "certificate_verification_failed";
    }
    
    return NextResponse.redirect(
      new URL(`/?error=${errorCode}`, req.url)
    );
  }
}
