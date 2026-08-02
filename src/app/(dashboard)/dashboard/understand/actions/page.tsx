import { ExecutivePageView, type ExecutiveSearchParams } from "../executive-page";
export default function Page({searchParams}:Readonly<{searchParams:ExecutiveSearchParams}>){return <ExecutivePageView searchParams={searchParams} tab="actions"/>}
