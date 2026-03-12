import Link from "next/link";

interface IntegrationCardProps {
  name: string;
  href: string;
  accountCount: number;
  description: string;
}

export function IntegrationCard({ name, href, accountCount, description }: IntegrationCardProps) {
  return (
    <Link
      href={href}
      className="block border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
    >
      <h2 className="text-xl font-semibold mb-1">{name}</h2>
      <p className="text-gray-500 text-sm mb-3">{description}</p>
      <p className="text-sm">
        <span className="font-medium">{accountCount}</span>{" "}
        {accountCount === 1 ? "account" : "accounts"} connected
      </p>
    </Link>
  );
}
