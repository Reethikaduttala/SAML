import { getSession, sessionOptions } from "@/lib/session";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";
import { NextRequest, NextResponse } from "next/server";

// Initialize Service Provider
const sp = getServiceProvider();

async function handleLogout(req: NextRequest) {
  // Get session first to check if user is logged in
  const tempRes = new NextResponse();
  const session = await getSession(req as any, tempRes as any);
  
  const hasSession = !!session.user?.nameID;
  const nameID = session.user?.nameID;
  const sessionIndex = session.user?.sessionIndex;
  
  // Destroy local session immediately
  if (session.user) {
    session.user = undefined;
  }
  await session.destroy();
  
  // Get IdP fresh on each request
  const idp = getIdentityProvider();
  
  // If Okta is configured and we have a valid session, perform SAML SLO
  if (idp && hasSession && nameID) {
    try {
      // Create SAML LogoutRequest
      // sessionIndex is optional - some IdPs don't require it
      const logoutParams: any = {
        nameID: nameID,
        relayState: "/",
      };
      
      if (sessionIndex) {
        logoutParams.sessionIndex = sessionIndex;
      }
      
      const { context } = await sp.createLogoutRequest(idp, "redirect", logoutParams);
      
      // Create redirect response to Okta logout endpoint
      // This will perform SAML Single Logout (SLO) which closes the Okta session
      const logoutRedirect = NextResponse.redirect(context);
      
      // Clear session cookie on redirect response
      const cookieName = sessionOptions.cookieName || "okta-session";
      const cookieOpts = sessionOptions.cookieOptions || {};
      
      logoutRedirect.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: cookieOpts.secure ?? (process.env.NODE_ENV === "production"),
        sameSite: "lax",
        maxAge: 0,
      });
      logoutRedirect.cookies.delete(cookieName);
      
      // Add cache-control headers to prevent caching
      logoutRedirect.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      logoutRedirect.headers.set("Pragma", "no-cache");
      logoutRedirect.headers.set("Expires", "0");
      
      // After Okta processes the logout, it will redirect to /api/auth/saml/logout/callback
      // which will then redirect to home page
      return logoutRedirect;
    } catch (sloError) {
      // If SLO fails, fall through to local logout
    }
  }
  
  // Fallback: Local logout only (if SLO not available or failed)
  // Redirect to home page with loggedOut parameter
  // This ensures the home page clears client-side storage
  const homeUrl = new URL("/", req.url);
  homeUrl.searchParams.set("loggedOut", "true");
  const res = NextResponse.redirect(homeUrl);
  
  // Clear session cookie
  const cookieName = sessionOptions.cookieName || "okta-session";
  const cookieOpts = sessionOptions.cookieOptions || {};
  
  res.cookies.set(cookieName, "", {
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: cookieOpts.secure ?? (process.env.NODE_ENV === "production"),
    sameSite: "lax",
    maxAge: 0,
  });
  res.cookies.delete(cookieName);
  
  // Add cache-control headers
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  
  return res;
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
