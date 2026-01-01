/**
 * SP-initiated Single Logout
 * Sends LogoutRequest to Okta for SAML Single Logout
 */

import { getSession } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { getIdentityProvider, getServiceProvider } from "@/lib/saml-config";

async function handleLogout(req: NextRequest) {
  // Create response object for session management
  const response = new NextResponse();
  
  // Get session to extract SAML data needed for logout
  const session = await getSession(req as any, response as any);
  
  const hasSession = !!session.user?.nameID;
  const nameID = session.user?.nameID;
  const sessionIndex = session.user?.sessionIndex;
  
  if (!hasSession || !nameID) {
    // No session - just redirect to home
    return NextResponse.redirect(new URL('/', req.url));
  }

  // CRITICAL: Destroy local session FIRST before sending LogoutRequest
  // This ensures local session is gone even if Okta doesn't respond
  if (session.user) {
    session.user = undefined;
  }
  try {
    await session.destroy();
  } catch (destroyError) {
    // Continue even if destroy fails
  }

  // Use samlify for SAML Single Logout
  const idp = getIdentityProvider();
  const sp = getServiceProvider();
  
  if (!idp || !sp) {
    // If SAML not configured, redirect to home
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Create SAML LogoutRequest using samlify
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                 (process.env.NODE_ENV === 'production' 
                   ? 'https://yourdomain.com' 
                   : 'http://localhost:3000');
  
  // Build logout parameters
  const logoutParams: any = {
    nameID: nameID,
    relayState: `${baseUrl}/api/auth/saml/logout/callback`,
  };
  
  // Add sessionIndex if available
  let actualSessionIndex: string | undefined = undefined;
  if (sessionIndex) {
    if (typeof sessionIndex === 'string') {
      actualSessionIndex = sessionIndex;
    } else if (typeof sessionIndex === 'object' && sessionIndex.sessionIndex) {
      actualSessionIndex = sessionIndex.sessionIndex;
    } else if (typeof sessionIndex === 'object' && (sessionIndex as any).SessionIndex) {
      actualSessionIndex = (sessionIndex as any).SessionIndex;
    }
    
    if (actualSessionIndex) {
      logoutParams.sessionIndex = actualSessionIndex;
    }
  }
  
  // Create LogoutRequest
  let logoutRequestResult;
  try {
    logoutRequestResult = await sp.createLogoutRequest(idp, "redirect", logoutParams);
  } catch (createError: any) {
    // If createLogoutRequest fails, try without sessionIndex
    if (sessionIndex && createError.message?.includes('sessionIndex')) {
      delete logoutParams.sessionIndex;
      logoutRequestResult = await sp.createLogoutRequest(idp, "redirect", logoutParams);
    } else {
      // If SAML logout fails, redirect to home (session already destroyed)
      // forceAuthn: true in login will ensure re-authentication is required
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  // Validate the result
  if (!logoutRequestResult || !logoutRequestResult.context) {
    // If SAML logout fails, redirect to home (session already destroyed)
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  const context = logoutRequestResult.context;
  
  // Validate the context URL
  if (typeof context !== 'string' || context.trim().length === 0) {
    // If SAML logout fails, redirect to home (session already destroyed)
    return NextResponse.redirect(new URL('/', req.url));
  }
  
  // Redirect to Okta logout endpoint (SAML SLO)
  return NextResponse.redirect(context);
}

export async function GET(req: NextRequest) {
  return handleLogout(req);
}

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
