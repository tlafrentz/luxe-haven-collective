export async function GET() {
  return Response.json({ ok: true, service: "luxe-haven-collective", timestamp: new Date().toISOString() });
}
