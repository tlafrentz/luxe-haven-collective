"use client";
import { useEffect } from "react";
import { recordFoundingPartnerEvent } from "@/app/actions/founding-partners";
export function FoundingPartnerPageView(){useEffect(()=>{void recordFoundingPartnerEvent("founding_partner_page_viewed")},[]);return null}
export function FoundingPartnerApplicationStarted(){useEffect(()=>{void recordFoundingPartnerEvent("founding_partner_application_started")},[]);return null}
export function FoundingPartnerCta({children,className}:{href?:string;children:React.ReactNode;className:string}){return <a href="/founding-partners/apply" className={className} onClick={()=>void recordFoundingPartnerEvent("founding_partner_cta_clicked")}>{children}</a>}
