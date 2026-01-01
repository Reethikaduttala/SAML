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
    
    // Validate IdP if it exists
    if (idp && typeof idp !== 'object') {
      return NextResponse.redirect(new URL("/?error=idp_invalid", req.url));
    }
    
    // CRITICAL: If Okta is configured, ALWAYS use Okta - NEVER use dev bypass
    if (hasOktaConfig) {
      // AGGRESSIVELY clear any existing sessions before redirecting to Okta
      const tempRes = new NextResponse();
      const existingSession = await getSession(req as any, tempRes as any);
      
      if (existingSession.user) {

        existingSession.user = undefined;
        try {
          await existingSession.destroy();
        } catch (destroyError) {
          // Continue even if destroy fails
        }
        // Double-check: clear again
        try {
          if (existingSession.user) {
            existingSession.user = undefined;
            await existingSession.save();
          }
        } catch (saveError) {
          // Continue
        }
      }
      
      // If IdP object exists, use proper SAML flow
      if (idp) {
        try {
          // Use the redirect URL from query params (defaults to /secure)
          const cleanRelayState = redirectUrl || "/secure";
          
          // Validate that we have a valid redirect URL
          if (!cleanRelayState || !cleanRelayState.startsWith('/')) {
            throw new Error(`Invalid redirect URL: ${cleanRelayState}`);
          }
          
          // forceAuthn: true ensures Okta ALWAYS shows the login page
          // This is critical after logout - even if user has an Okta session, they must re-authenticate
          // CRITICAL: Always use forceAuthn to force Okta to show login page
          const loginRequestResult = await sp.createLoginRequest(idp, "redirect", {
            relayState: cleanRelayState,
            forceAuthn: true, // CRITICAL: Force Okta to show login page (required after logout)
          });
          // Validate the result
          if (!loginRequestResult || !loginRequestResult.context) {
            throw new Error(`SAML createLoginRequest returned invalid result: ${JSON.stringify(loginRequestResult)}`);
          }
          
          const context = loginRequestResult.context;
          
          // Validate that context is a valid URL string
          if (typeof context !== 'string' || context.trim().length === 0) {
            throw new Error(`Invalid SAML redirect context: ${context}`);
          }
          
          const oktaRedirect = NextResponse.redirect(context);
          
          // AGGRESSIVELY clear any cookies that might still exist
          const cookieName = "okta-session";
          const cookieOpts = { secure: process.env.NODE_ENV === "production" };
          
          // Method 1: Set cookie with expired date
          oktaRedirect.cookies.set(cookieName, "", {
            expires: new Date(0),
            path: "/",
            httpOnly: true,
            secure: cookieOpts.secure,
            sameSite: "lax",
            maxAge: 0,
          });
          
          // Method 2: Delete cookie
          oktaRedirect.cookies.delete(cookieName);
          
          // Method 3: Set cookie with past date in Set-Cookie header directly
          const cookieValue = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; ${cookieOpts.secure ? 'Secure;' : ''} SameSite=Lax`;
          oktaRedirect.headers.append("Set-Cookie", cookieValue);
          
          // Copy Set-Cookie headers from session destroy
          if (tempRes.headers) {
            const setCookieHeaders = tempRes.headers.getSetCookie();
            if (setCookieHeaders && setCookieHeaders.length > 0) {
              setCookieHeaders.forEach((cookie: string) => {
                oktaRedirect.headers.append("Set-Cookie", cookie);
              });
            }
          }
          
          // Add cache-control headers to prevent caching
          oktaRedirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
          oktaRedirect.headers.set("Pragma", "no-cache");
          oktaRedirect.headers.set("Expires", "0");
          
          return oktaRedirect;
        } catch (samlError: any) {
          // Log error for debugging
          console.error("SAML login error:", samlError);
          // Fall through to error handling
          return NextResponse.redirect(new URL("/?error=saml_error", req.url));
        }
      }
      
      // Fallback: direct redirect to Okta entry point
      if (process.env.OKTA_ENTRY_POINT) {
        // Use the redirect URL from query params (defaults to /secure)
        const cleanRelayState = redirectUrl;
        const samlUrl =
          process.env.OKTA_ENTRY_POINT +
          "?RelayState=" +
          encodeURIComponent(cleanRelayState);
        
        const oktaRedirect = NextResponse.redirect(samlUrl);
        
        // AGGRESSIVELY clear any cookies that might still exist
        const cookieName = "okta-session";
        const cookieOpts = { secure: process.env.NODE_ENV === "production" };
        
        // Method 1: Set cookie with expired date
        oktaRedirect.cookies.set(cookieName, "", {
          expires: new Date(0),
          path: "/",
          httpOnly: true,
          secure: cookieOpts.secure,
          sameSite: "lax",
          maxAge: 0,
        });
        
        // Method 2: Delete cookie
        oktaRedirect.cookies.delete(cookieName);
        
        // Method 3: Set cookie with past date in Set-Cookie header directly
        const cookieValue = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; ${cookieOpts.secure ? 'Secure;' : ''} SameSite=Lax`;
        oktaRedirect.headers.append("Set-Cookie", cookieValue);
        
        // Copy Set-Cookie headers from session destroy
        if (tempRes.headers) {
          const setCookieHeaders = tempRes.headers.getSetCookie();
          if (setCookieHeaders && setCookieHeaders.length > 0) {
            setCookieHeaders.forEach((cookie: string) => {
              oktaRedirect.headers.append("Set-Cookie", cookie);
            });
          }
        }
        
        // Add cache-control headers to prevent caching
        oktaRedirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0, private");
        oktaRedirect.headers.set("Pragma", "no-cache");
        oktaRedirect.headers.set("Expires", "0");
        
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
