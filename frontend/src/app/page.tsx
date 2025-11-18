'use client';

import Link from 'next/link';
import { Activity, Database, AlertCircle, Settings } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Universal Crawler</h1>
        <p className="text-gray-600 mb-8">Operator Console</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/jobs" className="block">
            <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
              <div className="flex items-center mb-4">
                <Database className="w-8 h-8 text-blue-600 mr-3" />
                <h2 className="text-2xl font-semibold">Jobs</h2>
              </div>
              <p className="text-gray-600">
                View and manage crawl jobs. Monitor progress, create new jobs, and stop running tasks.
              </p>
            </div>
          </Link>

          <Link href="/captcha" className="block">
            <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
              <div className="flex items-center mb-4">
                <AlertCircle className="w-8 h-8 text-orange-600 mr-3" />
                <h2 className="text-2xl font-semibold">Captcha Queue</h2>
              </div>
              <p className="text-gray-600">
                Solve captchas encountered during crawling. Real-time notifications for new challenges.
              </p>
            </div>
          </Link>

          <Link href="/items" className="block">
            <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
              <div className="flex items-center mb-4">
                <Activity className="w-8 h-8 text-green-600 mr-3" />
                <h2 className="text-2xl font-semibold">Explorer</h2>
              </div>
              <p className="text-gray-600">
                Search and browse extracted items. Download artifacts and view metadata.
              </p>
            </div>
          </Link>

          <Link href="/sessions" className="block">
            <div className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200">
              <div className="flex items-center mb-4">
                <Settings className="w-8 h-8 text-purple-600 mr-3" />
                <h2 className="text-2xl font-semibold">Sessions</h2>
              </div>
              <p className="text-gray-600">
                Manage authentication sessions. Upload cookie bundles and OAuth tokens.
              </p>
            </div>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-2 text-blue-900">System Status</h3>
          <div className="text-sm text-blue-800">
            <div className="flex items-center justify-between mb-1">
              <span>API Server:</span>
              <span className="text-green-600 font-semibold">Connected</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Realtime:</span>
              <span className="text-green-600 font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
