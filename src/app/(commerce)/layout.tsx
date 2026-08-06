import Link from "next/link";

export default function CommerceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fffdf9]">
      {children}
      <footer className="border-t border-[#dde1dd] py-8">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 text-xs text-stone-500 sm:px-8">
          <span>© {new Date().getFullYear()} Luxe Haven Collective. Secure. Private. PCI Compliant.</span>
          <div className="flex gap-4 font-semibold text-stone-600">
            <Link href="/faq" className="hover:text-[#074e38]">
              Help
            </Link>
            <Link href="/contact" className="hover:text-[#074e38]">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
