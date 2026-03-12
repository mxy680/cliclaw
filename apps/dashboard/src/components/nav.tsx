import Link from "next/link";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/gmail", label: "Gmail" },
];

export function Nav() {
  return (
    <nav className="w-56 min-h-screen bg-gray-900 text-gray-100 p-4 flex flex-col gap-1">
      <div className="text-lg font-bold mb-6 px-3">cliclaw</div>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-3 py-2 rounded hover:bg-gray-800 transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
