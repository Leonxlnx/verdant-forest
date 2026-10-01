import {defineConfig} from 'vite';
// Capture runs the production engine directly. This avoids a development page
// shell and Cloudflare workers while preserving all geometry and WebGL shaders.
export default defineConfig({
 server:{host:'127.0.0.1',port:5173,strictPort:true,hmr:false,watch:null},
 plugins:[{name:'forest-capture-harness',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   if(req.url?.split('?')[0]!=='/')return next();
   const html=await server.transformIndexHtml('/',`<!doctype html><html><head><meta charset="UTF-8"><link rel="icon" href="/favicon.svg"><title>Forest capture</title><style>html,body{margin:0;overflow:hidden;background:#101914}#forest{width:100vw;height:100vh}canvas{display:block;width:100%;height:100%}.loading{position:absolute;top:0;color:white}</style></head><body><div id="forest"></div><script type="module">import {createForest} from '/app/forest/engine.ts';createForest(document.getElementById('forest'),()=>{}).catch(error=>{document.body.dataset.error=error.stack;console.error(error)});</script></body></html>`);
   res.setHeader('Content-Type','text/html');res.end(html);
  });
 }}],
});
