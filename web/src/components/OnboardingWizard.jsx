import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * OnboardingWizard - First-time setup for LLM configuration
 *
 * Features:
 * - Local LLM URL input with validation
 * - Provider selection (LM Studio or OpenRouter fallback)
 * - Connection test with live feedback
 * - Warnings about OpenRouter limitations
 * - Stores completion flag in localStorage
 * - For admin users, always show onboarding once per session
 */

const STORAGE_KEY = 'luminaquest_onboarding_completed';
const SESSION_SHOWN_KEY = 'luminaquest_onboarding_shown_this_session';

export function isOnboardingCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch (error) {
    console.warn('Failed to save onboarding state:', error);
  }
}

export function clearOnboardingState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear onboarding state:', error);
  }
}

export function shouldShowAdminOnboarding() {
  try {
    // Check if we've already shown onboarding this session
    return sessionStorage.getItem(SESSION_SHOWN_KEY) !== 'true';
  } catch {
    return true;
  }
}

export function markAdminOnboardingShown() {
  try {
    sessionStorage.setItem(SESSION_SHOWN_KEY, 'true');
  } catch (error) {
    console.warn('Failed to mark admin onboarding as shown:', error);
  }
}

// Developer helper: force show onboarding wizard
export function forceShowOnboarding() {
  clearOnboardingState();
  window.location.reload();
}

/**
 * @param {{ onComplete: () => void }} props
 */
export function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState('welcome'); // 'welcome' | 'configure' | 'validate' | 'complete'
  const [provider, setProvider] = useState('lmstudio');

  // Fetch default config from server
  const { data: defaultConfig } = useQuery({
    queryKey: ['onboarding-default-config'],
    queryFn: async () => (await api.get('/onboarding/default-config')).data,
    retry: false
  });

  // Initialize with server defaults
  const [lmStudioUrl, setLmStudioUrl] = useState('http://127.0.0.1:1234/v1');
  const [lmStudioModel, setLmStudioModel] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  // Update form when server defaults load
  useEffect(() => {
    if (defaultConfig) {
      if (defaultConfig.defaultLmStudioBaseUrl) {
        setLmStudioUrl(defaultConfig.defaultLmStudioBaseUrl);
      }
      if (defaultConfig.defaultLmStudioModel) {
        setLmStudioModel(defaultConfig.defaultLmStudioModel);
      }
    }
  }, [defaultConfig]);

  const validateMutation = useMutation({
    mutationFn: async (config) => {
      const response = await api.post('/onboarding/validate-llm', config);
      return response.data;
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setStep('validate');
    },
    onError: (error) => {
      setValidationResult({
        ok: false,
        message: error.response?.data?.message || error.message || 'Validation failed'
      });
      setStep('validate');
    }
  });

  const handleTestConnection = () => {
    // Validate required fields before testing
    if (provider === 'lmstudio' && !lmStudioModel?.trim()) {
      setValidationResult({
        ok: false,
        message: 'Model name is required. Please enter the model name from LM Studio.'
      });
      setStep('validate');
      return;
    }

    const config = {
      llmProvider: provider,
      lmStudioBaseUrl: provider === 'lmstudio' ? lmStudioUrl : undefined,
      lmStudioModel: provider === 'lmstudio' ? lmStudioModel.trim() : undefined,
      openRouterApiKey: provider === 'openrouter' ? openRouterKey : undefined,
      openRouterModel: provider === 'openrouter' ? 'meta-llama/llama-3.2-3b-instruct:free' : undefined
    };
    validateMutation.mutate(config);
  };

  const handleComplete = () => {
    setOnboardingCompleted();
    // Store config in localStorage for settings display and sessionStorage for current session
    try {
      const config = {
        provider,
        lmStudioUrl: provider === 'lmstudio' ? lmStudioUrl : '',
        lmStudioModel: provider === 'lmstudio' ? lmStudioModel.trim() : ''
      };

      // Store in localStorage for settings display
      localStorage.setItem('luminaquest_llm_provider', config.provider);
      localStorage.setItem('luminaquest_llm_url', config.lmStudioUrl);
      localStorage.setItem('luminaquest_llm_model', config.lmStudioModel);

      // Store in sessionStorage for API usage (if we implement client-side API calls)
      sessionStorage.setItem('luminaquest_llm_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save LLM config:', error);
    }
    setStep('complete');
  };

  const handleSkip = () => {
    // Skip with warning - no AI features available
    setOnboardingCompleted();
    onComplete();
  };

  // When entering complete step, wait 1.5s then finish
  useEffect(() => {
    if (step === 'complete') {
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <main className="onboarding-screen">
      <div className="onboarding-card">
        <header className="onboarding-header">
          <h1>Welcome to LuminaQuest</h1>
          <p className="subtitle">Let's set up your adventure workspace</p>
        </header>

        {step === 'welcome' && (
          <div className="onboarding-step fade-in">
            <div className="step-content">
              <h2>Choose Your AI Magic Source</h2>
              <p className="step-description">
                LuminaQuest uses AI to help create game stories and understand player actions.
                Choose how you'd like to power these features.
              </p>

              <div className="provider-options">
                <button
                  type="button"
                  className={`provider-card ${provider === 'lmstudio' ? 'selected' : ''}`}
                  onClick={() => setProvider('lmstudio')}
                >
                  <div className="provider-icon">🏠</div>
                  <h3>Local LLM (Recommended)</h3>
                  <p>Use your own local AI model</p>
                  <ul className="provider-features">
                    <li>✓ Free and private</li>
                    <li>✓ Fast response times</li>
                    <li>✓ Works offline</li>
                    <li>✓ Full creative control</li>
                  </ul>
                </button>

                <button
                  type="button"
                  className={`provider-card ${provider === 'openrouter' ? 'selected' : ''}`}
                  onClick={() => setProvider('openrouter')}
                >
                  <div className="provider-icon">🌐</div>
                  <h3>OpenRouter (Cloud)</h3>
                  <p>Use cloud-based AI models</p>
                  <ul className="provider-features">
                    <li>✗ Requires API key</li>
                    <li>✗ Costs money per use</li>
                    <li>✗ Slower than local</li>
                    <li>✗ Quality may vary</li>
                  </ul>
                  <p className="warning-text">
                    ⚠️ Dark Magic: Uses life force (money) in incalculable ways. Speed and quality
                    are suspect compared to local models.
                  </p>
                </button>
              </div>

              <div className="step-actions">
                <button type="button" className="btn-secondary" onClick={handleSkip}>
                  Skip (No AI Features)
                </button>
                <button type="button" className="btn-primary" onClick={() => setStep('configure')}>
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'configure' && (
          <div className="onboarding-step fade-in">
            <div className="step-content">
              <h2>Configure {provider === 'lmstudio' ? 'LM Studio' : 'OpenRouter'}</h2>

              {provider === 'lmstudio' ? (
                <>
                  <p className="step-description">
                    Enter your local LLM server URL. Make sure LM Studio or your preferred local
                    AI server is running before testing.
                  </p>

                  <div className="form-group">
                    <label htmlFor="lmstudio-url">Server URL</label>
                    <input
                      id="lmstudio-url"
                      type="url"
                      value={lmStudioUrl}
                      onChange={(e) => setLmStudioUrl(e.target.value)}
                      placeholder="http://127.0.0.1:1234/v1"
                      className="form-input"
                    />
                    <p className="form-hint">
                      Default: http://127.0.0.1:1234/v1 (LM Studio default)
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="lmstudio-model">Model Name <span className="required">*</span></label>
                    <input
                      id="lmstudio-model"
                      type="text"
                      value={lmStudioModel}
                      onChange={(e) => setLmStudioModel(e.target.value)}
                      placeholder={defaultConfig?.defaultLmStudioModel || 'e.g., google/gemma-3-4b'}
                      className="form-input"
                      required
                    />
                    <p className="form-hint">
                      The exact model name as shown in LM Studio (e.g., {defaultConfig?.defaultLmStudioModel || 'google/gemma-3-4b'})
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="step-description warning-text">
                    ⚠️ OpenRouter is a paid service. You will be charged for each API call made
                    during game authoring and gameplay.
                  </p>

                  <div className="form-group">
                    <label htmlFor="openrouter-key">API Key</label>
                    <input
                      id="openrouter-key"
                      type="password"
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      placeholder="sk-or-..."
                      className="form-input"
                    />
                    <p className="form-hint">
                      Get your key from{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        openrouter.ai/keys
                      </a>
                    </p>
                  </div>
                </>
              )}

              <div className="step-actions">
                <button type="button" className="btn-secondary" onClick={() => setStep('welcome')}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleTestConnection}
                  disabled={validateMutation.isPending}
                >
                  {validateMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'validate' && (
          <div className="onboarding-step fade-in">
            <div className="step-content">
              <h2>Connection Result</h2>

              {validationResult?.ok ? (
                <div className="validation-success">
                  <div className="success-icon">✓</div>
                  <h3>Connection Successful!</h3>
                  <p>
                    Connected to <strong>{validationResult.providerName}</strong> in{' '}
                    {validationResult.latency}ms
                  </p>
                  {validationResult.warning && (
                    <p className="warning-text">{validationResult.warning}</p>
                  )}
                  {validationResult.modelFound !== undefined && (
                    <p className="model-info">
                      Model: <code>{validationResult.testModel}</code>
                      {validationResult.modelFound ? ' ✓ Found' : ' ⚠️ Not in model list'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="validation-error">
                  <div className="error-icon">✕</div>
                  <h3>Connection Failed</h3>
                  <p className="error-message">{validationResult?.message}</p>
                  <p className="error-hint">
                    {provider === 'lmstudio'
                      ? 'Make sure LM Studio is running and the URL is correct.'
                      : 'Check your API key and try again.'}
                  </p>
                </div>
              )}

              <div className="step-actions">
                {validationResult?.ok ? (
                  <button type="button" className="btn-primary" onClick={handleComplete}>
                    Complete Setup
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" onClick={() => setStep('configure')}>
                    Try Again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="onboarding-step fade-in">
            <div className="step-content">
              <div className="success-icon">✓</div>
              <h2>You're All Set!</h2>
              <p>Your adventure workspace is ready.</p>
              <p className="muted">Entering LuminaQuest...</p>
            </div>
          </div>
        )}
      </div>

      <footer className="onboarding-footer">
        <p className="muted">
          {provider === 'lmstudio' ? (
            <>
              Need help? Download{' '}
              <a
                href="https://lmstudio.ai/"
                target="_blank"
                rel="noopener noreferrer"
              >
                LM Studio
              </a>{' '}
              and load a model before testing.
            </>
          ) : (
            <>
              AI features powered by{' '}
              <a
                href="https://openrouter.ai/"
                target="_blank"
                rel="noopener noreferrer"
              >
                OpenRouter
              </a>
              . Usage costs apply.
            </>
          )}
        </p>
      </footer>
    </main>
  );
}
