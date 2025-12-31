import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";

// Initialize SAML providers
const sp = getServiceProvider();

/**
 * Handles SAML LogoutResponse from Okta after Single Logout (SLO)
 * This endpoint receives the logout response from Okta after the user has been logged out
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;
    const relayState = formData.get("RelayState") as string | null;

    if (!samlResponse) {
      // If no SAML response, redirect to home with loggedOut parameter
      const homeUrl = new URL("/", req.url);
      homeUrl.searchParams.set("loggedOut", "true");
      return NextResponse.redirect(homeUrl);
    }

    const idp = getIdentityProvider();
    if (!idp) {
      // If IdP not configured, redirect to home with loggedOut parameter
      const homeUrl = new URL("/", req.url);
      homeUrl.searchParams.set("loggedOut", "true");
      return NextResponse.redirect(homeUrl);
    }

    // Parse logout response to verify Okta processed the logout
    try {
      await sp.parseLogoutResponse(idp, "post", {
        body: {
          SAMLResponse: samlResponse,
          RelayState: relayState || undefined,
        },
      });
    } catch (parseError) {
      // Even if parsing fails, redirect to home (logout is best-effort)
    }

    // Redirect to home page - Okta session is now closed
    // Next login will require fresh authentication due to forceAuthn: true
    const homeUrl = new URL("/", req.url);
    homeUrl.searchParams.set("loggedOut", "true");
    
    const response = NextResponse.redirect(homeUrl);
    
    // Ensure no session cookies remain
    const cookieName = "okta-session";
    response.cookies.set(cookieName, "", {
      expires: new Date(0),
      path: "/",
      maxAge: 0,
    });
    response.cookies.delete(cookieName);
    
    // Add cache-control headers
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  } catch (error) {
    // On any error, redirect to home with loggedOut parameter
    const homeUrl = new URL("/", req.url);
    homeUrl.searchParams.set("loggedOut", "true");
    return NextResponse.redirect(homeUrl);
  }
}

export async function GET(req: NextRequest) {
  // Handle GET redirects (HTTP-Redirect binding)
  const samlResponse = req.nextUrl.searchParams.get("SAMLResponse");
  const relayState = req.nextUrl.searchParams.get("RelayState");

  if (!samlResponse) {
    const homeUrl = new URL("/", req.url);
    homeUrl.searchParams.set("loggedOut", "true");
    return NextResponse.redirect(homeUrl);
  }

  const idp = getIdentityProvider();
  if (!idp) {
    const homeUrl = new URL("/", req.url);
    homeUrl.searchParams.set("loggedOut", "true");
    return NextResponse.redirect(homeUrl);
  }

  // Parse logout response to verify Okta processed the logout
  try {
    await sp.parseLogoutResponse(idp, "redirect", {
      body: {
        SAMLResponse: samlResponse,
        RelayState: relayState || undefined,
      },
    });
  } catch (parseError) {
    // Even if parsing fails, redirect to home
  }

  // Redirect to home page - Okta session is now closed
  const homeUrl = new URL("/", req.url);
  homeUrl.searchParams.set("loggedOut", "true");
  
  const response = NextResponse.redirect(homeUrl);
  
  // Ensure no session cookies remain
  const cookieName = "okta-session";
  response.cookies.set(cookieName, "", {
    expires: new Date(0),
    path: "/",
    maxAge: 0,
  });
  response.cookies.delete(cookieName);
  
  // Add cache-control headers
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  
  return response;
}

