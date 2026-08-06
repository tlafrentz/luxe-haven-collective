import {ExperienceComponentVersionDetail} from "@/components/guidebooks/experience-component-library";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{componentId:string;versionId:string}>}){return <ExperienceComponentVersionDetail {...await params}/>}
