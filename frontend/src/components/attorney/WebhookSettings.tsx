import { useState, useEffect } from "react";
import type { WebhookConfigRead, WebhookTestResult } from "../../types/api";

interface WebhookSettingsProps {
  token: string;
}

export default function WebhookSettings({ token }: WebhookSettingsProps) {
  const [config, setConfig] = useState<WebhookConfigRead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);

  // Form state
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Action state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);

  useEffect(() => {
    async function loadConfig() {
      setLoadingInit(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/attorney/webhook", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to load webhook config (${res.status})`);
        const data: WebhookConfigRead = await res.json();
        setConfig(data);
        setUrl(data.url ?? "");
        setEnabled(data.enabled);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Failed to load webhook config");
      } finally {
        setLoadingInit(false);
      }
    }
    loadConfig();
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    setTestResult(null);
    try {
      const res = await fetch("/api/attorney/webhook", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, secret, enabled }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Save failed (${res.status})`);
      }
      const updated: WebhookConfigRead = await res.json();
      setConfig(updated);
      setUrl(updated.url ?? "");
      setEnabled(updated.enabled);
      setSecret(""); // clear secret field after save
      setSaveSuccess(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/attorney/webhook/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Test request failed (${res.status})`);
      }
      const result: WebhookTestResult = await res.json();
      setTestResult(result);
    } catch (e: unknown) {
      setTestResult({
        success: false,
        status_code: null,
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setTesting(false);
    }
  }

  const inFlight = saving || testing;
  const hasUrl = url.trim().length > 0;

  if (loadingInit) {
    return (
      <p className="font-mono text-[0.7rem] text-[rgba(25,25,24,0.45)] uppercase tracking-widest">
        Loading webhook config...
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-md px-4 py-3 text-sm">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1">
          Webhook Settings
        </p>
        <p className="text-sm text-[rgba(25,25,24,0.55)]">
          Receive HTTP POST notifications when new leads are assigned to your account.
        </p>
      </div>

      <div className="bg-white border border-[rgba(25,25,24,0.12)] rounded-[10px] p-5 space-y-4">
        {/* URL field */}
        <div>
          <label
            htmlFor="webhook-url"
            className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1.5"
          >
            Endpoint URL
          </label>
          <input
            id="webhook-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            className="w-full border border-[rgba(25,25,24,0.12)] rounded-md px-3 py-2 text-sm text-[#191918] bg-white placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:border-[#FCAA2D] focus:ring-1 focus:ring-[#FCAA2D]"
          />
        </div>

        {/* Secret field */}
        <div>
          <label
            htmlFor="webhook-secret"
            className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)] mb-1.5"
          >
            Signing Secret
          </label>
          <input
            id="webhook-secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              config?.has_secret
                ? "Leave blank to keep existing secret"
                : "Enter webhook secret"
            }
            className="w-full border border-[rgba(25,25,24,0.12)] rounded-md px-3 py-2 text-sm text-[#191918] bg-white placeholder:text-[rgba(25,25,24,0.3)] focus:outline-none focus:border-[#FCAA2D] focus:ring-1 focus:ring-[#FCAA2D]"
          />
          {config?.has_secret && (
            <p className="mt-1 font-mono text-[0.6rem] text-[rgba(25,25,24,0.4)]">
              A secret is currently set.
            </p>
          )}
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-mono text-[0.65rem] uppercase tracking-widest text-[rgba(25,25,24,0.45)]">
              Enabled
            </span>
            <span className="text-xs text-[rgba(25,25,24,0.4)]">
              Deliver webhook events to the endpoint above
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FCAA2D] focus:ring-offset-1 ${
              enabled ? "bg-[#FCAA2D]" : "bg-[rgba(25,25,24,0.15)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={inFlight}
            className="rounded-md bg-[#FCAA2D] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] px-5 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={inFlight || !hasUrl}
            title={!hasUrl ? "Enter a URL first" : undefined}
            className="rounded-md border border-[rgba(25,25,24,0.12)] text-[#191918] font-mono text-[0.7rem] uppercase tracking-wide min-h-[44px] px-5 disabled:opacity-40 hover:border-[rgba(25,25,24,0.35)] transition-colors"
          >
            {testing ? "Testing..." : "Send Test"}
          </button>
        </div>

        {/* Save feedback */}
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2.5 text-sm text-green-800">
            Webhook settings saved successfully.
          </div>
        )}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2.5 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* Test result */}
        {testResult !== null && (
          <div
            className={`rounded-md px-4 py-2.5 text-sm ${
              testResult.success
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {testResult.success ? (
              <span>
                Test delivered successfully
                {testResult.status_code !== null && (
                  <span className="font-mono ml-1 text-[0.7rem]">
                    (HTTP {testResult.status_code})
                  </span>
                )}
                .
              </span>
            ) : (
              <span>
                Test failed
                {testResult.status_code !== null && (
                  <span className="font-mono ml-1 text-[0.7rem]">
                    (HTTP {testResult.status_code})
                  </span>
                )}
                {testResult.error && <span>: {testResult.error}</span>}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
