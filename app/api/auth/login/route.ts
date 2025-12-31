import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";
import { setSession, getSession } from "@/lib/session";

// Get redirect URL from query params or default to /secure
function getRedirectUrl(req: NextRequest): string {
  const searchParams = req.nextUrl.searchParams;
  const redirect = searchParams.get("redirect");
  
  if (redirect) {
    const cleaned = redirect.trim().split(',')[0].trim();
    if (cleaned.startsWith('/')) {
      return cleaned;
    }
  }
  
  return "/secure";
}

// Initialize SAML providers
const sp = getServiceProvider();

export async function GET(req: NextRequest) {
  try {
    const redirectUrl = getRedirectUrl(req);
    
    // Get IdP fresh on each request
    const idp = getIdentityProvider();
    
    // Check if Okta is configured
    const hasOktaConfig = !!idp || !!process.env.OKTA_ENTRY_POINT;
    const devBypass = process.env.ENABLE_DEV_BYPASS === "true";
    
    // CRITICAL: If Okta is configured, ALWAYS use Okta - NEVER use dev bypass
    if (hasOktaConfig) {
      // ALWAYS clear any existing sessions before redirecting to Okta
      const tempRes = new NextResponse();
      const existingSession = await getSession(req as any, tempRes as any);
      
      if (existingSession.user) {
        existingSession.user = undefined;
        await existingSession.destroy();
      }
      
      // If IdP object exists, use proper SAML flow
      if (idp) {
        try {
          const cleanRelayState = "/secure";
          // forceAuthn: true ensures Okta ALWAYS shows the login page
          // This is critical after logout - even if user has an Okta session, they must re-authenticate
          const { context } = await sp.createLoginRequest(idp, "redirect", {
            relayState: cleanRelayState,
            forceAuthn: true, // CRITICAL: Force Okta to show login page (required after logout)
          });
          
          const oktaRedirect = NextResponse.redirect(context);
          
          // Clear any cookies that might still exist
          const cookieName = "okta-session";
          oktaRedirect.cookies.set(cookieName, "", {
            expires: new Date(0),
            path: "/",
            maxAge: 0,
          });
          oktaRedirect.cookies.delete(cookieName);
          
          // Copy Set-Cookie headers from session destroy
          if (tempRes.headers) {
            const setCookieHeaders = tempRes.headers.getSetCookie();
            if (setCookieHeaders && setCookieHeaders.length > 0) {
              setCookieHeaders.forEach((cookie: string) => {
                oktaRedirect.headers.append("Set-Cookie", cookie);
              });
            }
          }
          
          return oktaRedirect;
        } catch (samlError: any) {
          throw samlError;
        }
      }
      
      // Fallback: direct redirect to Okta entry point
      if (process.env.OKTA_ENTRY_POINT) {
        const cleanRelayState = "/secure";
        const samlUrl =
          process.env.OKTA_ENTRY_POINT +
          "?RelayState=" +
          encodeURIComponent(cleanRelayState);
        
        const oktaRedirect = NextResponse.redirect(samlUrl);
        
        // Clear any cookies that might still exist
        const cookieName = "okta-session";
        oktaRedirect.cookies.set(cookieName, "", {
          expires: new Date(0),
          path: "/",
          maxAge: 0,
        });
        oktaRedirect.cookies.delete(cookieName);
        
        // Copy Set-Cookie headers from session destroy
        if (tempRes.headers) {
          const setCookieHeaders = tempRes.headers.getSetCookie();
          if (setCookieHeaders && setCookieHeaders.length > 0) {
            setCookieHeaders.forEach((cookie: string) => {
              oktaRedirect.headers.append("Set-Cookie", cookie);
            });
          }
        }
        
        return oktaRedirect;
      }
      
      return NextResponse.redirect(new URL("/?error=okta_config_error", req.url));
    }

    // Development bypass: ONLY use if Okta is completely NOT configured
    if (devBypass && !hasOktaConfig) {
      const response = NextResponse.redirect(new URL(redirectUrl, req.url));
      await setSession(req as any, response as any, {
        nameID: "dev-user@example.com",
        email: "dev-user@example.com",
        firstName: "Dev",
        lastName: "User",
        attributes: {},
      });
      return response;
    }

    // If no configuration at all
    if (!devBypass) {
      return NextResponse.redirect(new URL("/?error=idp_not_configured", req.url));
    }
    
    return NextResponse.json(
      { error: "Okta configuration not found" },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Login failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
