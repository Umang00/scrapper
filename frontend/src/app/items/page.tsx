'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ExternalLink } from 'lucide-react';

interface Item {
  id: string;
  crawl_id: string;
  url: string;
  source_platform: string;
  content_type: string;
  title: string | null;
  author_handle: string | null;
  extracted_at: string;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<string>('all');

  useEffect(() => {
    loadItems();
  }, [platform]);

  const loadItems = async () => {
    setLoading(true);
    const response = await apiClient.listItems({
      source_platform: platform !== 'all' ? platform : undefined,
    });

    if (response.status === 'success' && response.data) {
      setItems(response.data as Item[]);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Extracted Items</h1>

      <div className="mb-6 flex gap-2">
        {['all', 'blog', 'twitter', 'instagram', 'reddit'].map((p) => (
          <button
            key={p}
            onClick={() => setPlatform(p)}
            className={`px-4 py-2 rounded-lg ${
              platform === p
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading items...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-600">No items found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {item.source_platform}
                    </span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                      {item.content_type}
                    </span>
                  </div>

                  {item.title && (
                    <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                  )}

                  {item.author_handle && (
                    <p className="text-sm text-gray-600 mb-2">
                      By @{item.author_handle}
                    </p>
                  )}

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {item.url.slice(0, 60)}...
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <p className="text-xs text-gray-500 mt-2">
                    Extracted: {new Date(item.extracted_at).toLocaleString()}
                  </p>
                </div>

                <Link
                  href={`/items/${item.id}`}
                  className="ml-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
