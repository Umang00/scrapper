'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useJobChannel } from '@/hooks/useJobChannel';
import { ArrowLeft, Square, RefreshCw } from 'lucide-react';

interface Job {
  id: string;
  connector: string;
  source_platform: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  total_urls: number;
  processed_urls: number;
  success_count: number;
  error_count: number;
  urls: string[];
  config: Record<string, unknown>;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params?.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const { events, connected } = useJobChannel(jobId);

  useEffect(() => {
    loadJob();
  }, [jobId]);

  useEffect(() => {
    // Refresh job on new events
    if (events.length > 0) {
      loadJob();
    }
  }, [events]);

  const loadJob = async () => {
    const response = await apiClient.getJob(jobId);

    if (response.status === 'success' && response.data) {
      setJob(response.data as Job);
    }
    setLoading(false);
  };

  const stopJob = async () => {
    await apiClient.stopJob(jobId);
    loadJob();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading job...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">Job not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/jobs"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Job {job.id.slice(0, 8)}...</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>
                <span className="font-semibold">Connector:</span> {job.connector}
              </span>
              <span>
                <span className="font-semibold">Platform:</span> {job.source_platform}
              </span>
              <span>
                <span className="font-semibold">Status:</span>{' '}
                <span
                  className={`px-2 py-1 rounded ${
                    job.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : job.status === 'running'
                      ? 'bg-blue-100 text-blue-800'
                      : job.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {job.status}
                </span>
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {job.status === 'running' && (
              <button
                onClick={stopJob}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Job
              </button>
            )}
            <button
              onClick={loadJob}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Total URLs</div>
            <div className="text-2xl font-bold">{job.total_urls}</div>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Processed</div>
            <div className="text-2xl font-bold text-blue-600">{job.processed_urls}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Success</div>
            <div className="text-2xl font-bold text-green-600">{job.success_count}</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-600">{job.error_count}</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-2">Progress</div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all"
              style={{
                width: `${(job.processed_urls / job.total_urls) * 100}%`,
              }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {((job.processed_urls / job.total_urls) * 100).toFixed(1)}% complete
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-gray-300'
              }`}
            ></span>
            <span className="text-gray-600">
              Realtime: {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Live Event Stream</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events yet...</p>
          ) : (
            events
              .slice()
              .reverse()
              .map((evt, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 rounded border border-gray-200 text-sm"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold">{evt.event}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(
                        'payload' in evt.payload ? evt.payload.timestamp : ''
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                  <pre className="mt-1 text-xs text-gray-600">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
