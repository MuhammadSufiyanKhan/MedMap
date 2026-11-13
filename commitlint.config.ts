import { RuleConfigSeverity } from '@commitlint/types';
import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [RuleConfigSeverity.Error, 'always', 72],
    'body-max-line-length': [RuleConfigSeverity.Disabled, 'always', 100],
    'footer-max-line-length': [RuleConfigSeverity.Disabled, 'always', 100],
  },
};

export default config;
