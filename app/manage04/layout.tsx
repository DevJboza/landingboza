import type { Metadata, Viewport } from "next";
import "./manage.css";
export const metadata:Metadata={title:"Boza Control Center",description:"Centro privado de operaciones de BOZA",manifest:"/manage04/manifest.webmanifest",appleWebApp:{capable:true,title:"Boza Control",statusBarStyle:"black-translucent"},robots:{index:false,follow:false}};
export const viewport:Viewport={themeColor:"#07100f",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function ManageLayout({children}:{children:React.ReactNode}){return <div className="bcc-root">{children}</div>}
