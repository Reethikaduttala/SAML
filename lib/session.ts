import { getIronSession } from "iron-session";

export const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "okta-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export interface SessionData {
  user?: any;
}

export async function getSession(req: any, res: any) {
  // Adapt NextRequest/NextResponse to the shape expected by iron-session.
  // iron-session expects `req.headers.cookie` and `res.getHeader`/`res.setHeader`.
  const ironReq = {
    headers: {
      cookie:
        // NextRequest
        typeof req?.headers?.get === "function"
          ? (req.headers.get("cookie") as string) || ""
          : // Node request-like
          req?.headers?.cookie || "",
    },
  } as any;

  const ironRes = {
    getHeader: (name: string) => {
      if (res?.headers && typeof res.headers.get === "function") {
        return res.headers.get(name) as string | undefined;
      }
      if (typeof res?.getHeader === "function") return res.getHeader(name);
      return undefined;
    },
    setHeader: (name: string, value: string) => {
      if (res?.headers && typeof res.headers.set === "function") {
        res.headers.set(name, value);
        return;
      }
      if (typeof res?.setHeader === "function") return res.setHeader(name, value);
    },
  } as any;

  return getIronSession<SessionData>(ironReq, ironRes, sessionOptions as any);
}

export async function setSession(req: any, res: any, user: any) {
  const session = await getSession(req, res);
  session.user = user;
  await session.save();
}
