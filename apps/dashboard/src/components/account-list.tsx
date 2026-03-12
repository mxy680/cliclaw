"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Account {
  name: string;
  email: string | null;
}

interface AccountListProps {
  accounts: Account[];
  removeAction: (accountName: string) => Promise<{ success: boolean }>;
}

export function AccountList({ accounts, removeAction }: AccountListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [accountName, setAccountName] = useState("");

  function handleAdd() {
    if (!adding) {
      setAdding(true);
      return;
    }
    const name = accountName.trim();
    if (!name) return;
    window.location.href = `/api/oauth/gmail?account=${encodeURIComponent(name)}`;
  }

  async function handleRemove(name: string) {
    await removeAction(name);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        {adding && (
          <input
            type="text"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Account name"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            autoFocus
          />
        )}
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          {adding ? "Connect" : "Add Account"}
        </button>
        {adding && (
          <button
            onClick={() => { setAdding(false); setAccountName(""); }}
            className="text-gray-500 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="text-gray-500 text-sm">No accounts connected yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {accounts.map((account) => (
            <li key={account.name} className="py-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{account.name}</span>
                {account.email && (
                  <span className="text-gray-500 text-sm ml-2">{account.email}</span>
                )}
              </div>
              <button
                onClick={() => handleRemove(account.name)}
                className="text-red-600 text-sm hover:text-red-800"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
