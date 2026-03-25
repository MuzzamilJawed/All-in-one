"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useSettings } from "../context/SettingsContext";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [mounted, setMounted] = useState(false);

  // Ensure hydration match
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (key: string, value: string | boolean) => {
    if (key === 'theme') {
      setTheme(value as string);
    } else if (key === 'refreshInterval') {
      updateSettings({ [key]: parseInt(value as string) });
    } else {
      updateSettings({ [key]: value });
    }
  };

  const handleSave = () => {
    alert("Settings are saved automatically!");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            ⚙️ Settings
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Customize your dashboard experience
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-2xl">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700">
          <div className="p-6 space-y-6">
            {/* Display Settings */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Display Settings
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Currency
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-600"
                  >
                    <option>PKR</option>
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Theme
                  </label>
                  <select
                    value={mounted ? theme : 'system'}
                    onChange={(e) => handleChange("theme", e.target.value)}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-600"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Refresh Interval (seconds)
                  </label>
                  <select
                    value={settings.refreshInterval}
                    onChange={(e) => handleChange("refreshInterval", e.target.value)}
                    className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-600"
                  >
                    <option value="1">1 second</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="120">2 minutes</option>
                    <option value="300">5 minutes</option>
                  </select>
                </div>
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Notification Settings */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Notifications
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Enable Notifications
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.notifications}
                    onChange={(e) => handleChange("notifications", e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-600"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Sound Alerts
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.soundAlerts}
                    onChange={(e) => handleChange("soundAlerts", e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-600"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-zinc-900 dark:text-zinc-50 font-medium">
                    Price Alerts
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.priceAlerts}
                    onChange={(e) => handleChange("priceAlerts", e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-600"
                  />
                </div>
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-700" />

            {/* Data & Privacy */}
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Data & Privacy
              </h2>
              <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  • Your data is stored locally in your browser cache
                </p>
                <p>
                  • No personal information is sent to external servers
                </p>
                <p>
                  • Market data is fetched from public APIs
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={() => alert("Settings reset to default")}
              className="flex-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Reset to Default
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>ℹ️ Tip:</strong> Your settings are saved automatically. Visit this page anytime to update your preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
