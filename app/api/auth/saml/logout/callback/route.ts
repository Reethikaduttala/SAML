/**
 * Handles LogoutResponse from Okta after Single Logout
 * This endpoint receives the SAML LogoutResponse after Okta processes the logout
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, sessionOptions } from "@/lib/session";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";

const sp = getServiceProvider();

export async function GET(req: NextRequest) {
  return handleLogoutResponse(req, 'HTTP-Redirect');
}

export async function POST(req: NextRequest) {
  return handleLogoutResponse(req, 'HTTP-POST');
}

async function handleLogoutResponse(req: NextRequest, binding: 'HTTP-Redirect' | 'HTTP-POST') {
  try {
    // Get SAMLResponse parameter
    const url = new URL(req.url);
    const samlResponse = binding === 'HTTP-Redirect'
      ? url.searchParams.get('SAMLResponse')
      : (await req.formData()).get('SAMLResponse') as string | null;

    // If no response, just redirect to home (logout is best-effort)
    if (!samlResponse) {
      return redirectToHome(req);
    }

    // Parse and validate LogoutResponse
    const idp = getIdentityProvider();
    if (idp) {
      try {
        await sp.parseLogoutResponse(idp, binding, {
          body: {
            SAMLResponse: samlResponse,
          },
        });
      } catch (parseError) {
        // Even if parsing fails, continue with logout (best-effort)
      }
    }

    // Destroy local session after receiving LogoutResponse from Okta
    const tempRes = new NextResponse();
    const session = await getSession(req as any, tempRes as any);
    
    if (session.user) {
      session.user = undefined;
      try {
        await session.destroy();
      } catch (error) {
        // Continue even if destroy fails
      }
    }
 
    // CRITICAL: Redirect to Okta signout to ensure Okta session is fully terminated
    // Use fromURI parameter to redirect back to our home page after signout
    const baseUrl = process.env.BASE_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://yourdomain.com' 
                     : 'http://localhost:3000');
    const homePageUrl = `${baseUrl}/?loggedOut=true`;
    const oktaSignoutUrl = "https://trial-5997860.okta.com/login/signout?fromURI=" + encodeURIComponent(homePageUrl);
    
    const response = NextResponse.redirect(oktaSignoutUrl);
    clearSessionCookies(response);
    return response;
  } catch (error: any) {
    // On any error, redirect to home
    return redirectToHome(req);
  }
}

function clearSessionCookies(response: NextResponse) {
  const cookieName = sessionOptions.cookieName || "okta-session";
  const cookieOpts = sessionOptions.cookieOptions || {};
  
  // Method 1: Set cookie with expired date
  response.cookies.set(cookieName, "", {
    expires: new Date(0),
    path: "/",
    httpOnly: true,
    secure: cookieOpts.secure ?? (process.env.NODE_ENV === "production"),
    sameSite: "lax",
    maxAge: 0,
  });
  
  // Method 2: Delete cookie
  response.cookies.delete(cookieName);
  response.cookies.delete(`${cookieName}.sig`);
  
  // Method 3: Set cookie header directly
  const cookieValue = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; ${cookieOpts.secure ? 'Secure;' : ''} SameSite=Lax`;
  response.headers.append("Set-Cookie", cookieValue);
  
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

function redirectToHome(req: NextRequest) {
  const homeUrl = new URL("/", req.url);
  homeUrl.searchParams.set("loggedOut", "true");
  
  const response = NextResponse.redirect(homeUrl.toString());
  clearSessionCookies(response);
  
  return response;
}

