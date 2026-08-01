import { useEffect, useState } from 'react';
import { CheckCircle2, PlugZap, X } from 'lucide-react';
import {
  ConnectionTestResult,
  SettingsSnapshot,
} from '../../shared/types';

interface SettingsPanelProps {
  open: boolean;
  settings: SettingsSnapshot | null;
  onClose: () => void;
  onSave: (input: {
    llm: SettingsSnapshot['llm'];
    apiKey?: string;
    clearApiKey?: boolean;
  }) => Promise<void>;
  onTest: (llm: SettingsSnapshot['llm'], apiKey?: string) => Promise<ConnectionTestResult>;
}

export function SettingsPanel({
  open,
  settings,
  onClose,
  onSave,
  onTest,
}: SettingsPanelProps) {
  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [protocol, setProtocol] = useState<SettingsSnapshot['llm']['protocol']>('openai');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && open) {
      setEnabled(settings.llm.enabled);
      setBaseUrl(settings.llm.baseUrl);
      setModel(settings.llm.model);
      setProtocol(settings.llm.protocol);
      setApiKey('');
      setClearApiKey(false);
      setResult(null);
      setErrorMessage('');
    }
  }, [settings, open]);

  if (!open) return null;

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave({
        llm: { enabled, baseUrl, model, protocol },
        apiKey: apiKey || undefined,
        clearApiKey: clearApiKey || undefined,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (): Promise<void> => {
    setResult(null);
    setErrorMessage('');
    try {
      setResult(await onTest({ enabled, baseUrl, model, protocol }, apiKey || undefined));
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">偏好</span>
            <h2>LLM 设置</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="关闭">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="settings-form">
          <label className="toggle">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>启用 LLM 生成</span>
          </label>
          <label className="field">
            <span>Base URL</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label className="field">
            <span>模型</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
          <label className="field">
            <span>接口协议</span>
            <select
              value={protocol}
              onChange={(event) => setProtocol(event.target.value as SettingsSnapshot['llm']['protocol'])}
            >
              <option value="openai">OpenAI 兼容</option>
              <option value="anthropic">Anthropic 兼容</option>
            </select>
          </label>
          <label className="field">
            <span>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings?.hasApiKey ? '已保存密钥，留空保持不变' : '输入 API Key'}
            />
          </label>
          {settings?.hasApiKey && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={clearApiKey}
                onChange={(event) => setClearApiKey(event.target.checked)}
              />
              <span>清除已保存的密钥</span>
            </label>
          )}
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={handleTest}>
              <PlugZap size={16} aria-hidden="true" />
              测试连接
            </button>
            <button className="primary-button" type="button" onClick={handleSave} disabled={saving}>
              <CheckCircle2 size={16} aria-hidden="true" />
              保存设置
            </button>
          </div>
          {errorMessage && <div className="message error">{errorMessage}</div>}
          {result && (
            <div className={`test-result ${result.ok ? 'ok' : 'error'}`}>
              {result.message}（{result.latencyMs}ms）
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
