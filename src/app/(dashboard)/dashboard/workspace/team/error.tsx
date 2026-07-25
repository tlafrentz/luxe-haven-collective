"use client";
import { WorkspaceErrorState, WorkspacePage } from "@/components/application-layout";
export default function TeamError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <WorkspacePage width="medium"><WorkspaceErrorState title="Team settings could not be loaded" description="No access was changed. Try loading the section again." retry={reset} details={error.digest?`Reference: ${error.digest}`:undefined}/></WorkspacePage>;}
