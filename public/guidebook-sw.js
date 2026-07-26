const CACHE="luxe-guidebooks-v1";
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==self.location.origin)return;if(!url.pathname.startsWith("/g/")&&!url.pathname.startsWith("/_next/")&&!url.pathname.startsWith("/images/"))return;event.respondWith(caches.open(CACHE).then(async cache=>{try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response}catch{return(await cache.match(request))||new Response("This guidebook is temporarily unavailable offline.",{status:503,headers:{"Content-Type":"text/plain"}})}}))});
