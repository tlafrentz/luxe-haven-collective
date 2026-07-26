"use client";
import { FinancialOverviewErrorView } from "@/features/financial-intelligence/presentation";
export default function Error() { return <FinancialOverviewErrorView code="unexpected" message="Financial Overview could not be completed. Your workspace and financial records were not changed." />; }
