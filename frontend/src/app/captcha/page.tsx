'use client';

import { useState } from 'react';
import { useCaptchaQueue } from '@/hooks/useCaptchaQueue';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function CaptchaQueuePage() {
  const { captchas, connected } = useCaptchaQueue();
  const [solutions, setSolutions] = useState<Record<string, string>>({});
  const [solvedBy] = useState('operator@example.com');

  const solveCaptcha = async (captchaId: string) => {
    const solution = solutions[captchaId];
    if (!solution) return;

    const response = await apiClient.solveCaptcha(captchaId, solution, solvedBy);

    if (response.status === 'success') {
      setSolutions((prev) => {
        const updated = { ...prev };
        delete updated[captchaId];
        return updated;
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Captcha Queue</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-gray-300'
            }`}
          ></span>
          <span>Realtime: {connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {captchas.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
          <p className="text-gray-600">No captchas in the queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {captchas.map((captcha) => (
            <div key={captcha.captcha_id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-8 h-8 text-orange-500" />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        {captcha.captcha_type}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Job: {captcha.job_id.slice(0, 8)}... • Platform:{' '}
                        {captcha.source_platform}
                      </p>
                      <p className="text-sm text-gray-600">URL: {captcha.url}</p>
                      {captcha.site_key && (
                        <p className="text-xs text-gray-500 mt-1">
                          Site Key: {captcha.site_key}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Timeout:{' '}
                      {new Date(captcha.timeout_at).toLocaleTimeString()}
                    </div>
                  </div>

                  {captcha.screenshot_url && (
                    <div className="mb-4">
                      <img
                        src={captcha.screenshot_url}
                        alt="Captcha Screenshot"
                        className="max-w-full h-auto rounded border border-gray-200"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter solution token..."
                      value={solutions[captcha.captcha_id] || ''}
                      onChange={(e) =>
                        setSolutions((prev) => ({
                          ...prev,
                          [captcha.captcha_id]: e.target.value,
                        }))
                      }
                      className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => solveCaptcha(captcha.captcha_id)}
                      disabled={!solutions[captcha.captcha_id]}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
