"use client";
import{useEffect}from"react";import{useRouter}from"next/navigation";
export function CommunicationContextRefresh({intervalMilliseconds=15_000}:{intervalMilliseconds?:number}){const router=useRouter();useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==="visible")router.refresh();},intervalMilliseconds);return()=>window.clearInterval(timer);},[intervalMilliseconds,router]);return null;}
