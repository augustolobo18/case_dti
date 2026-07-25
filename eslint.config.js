// Flat config do ESLint 9+ (ver Seção 2 do plano de ferramental).
//
// A ordem dos blocos importa: em flat config o último bloco que casar com um
// arquivo vence. `eslint-config-prettier` precisa ser o último, para desligar
// qualquer regra de estilo do ESLint que conflite com o Prettier.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Bloco 1: ignora pastas geradas/instaladas em qualquer verificação.
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },

  // Bloco 2: código-fonte do projeto TypeScript (dentro do include do
  // tsconfig.json), com regras type-aware habilitadas via projectService.
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Bloco 3: arquivos de config na raiz (fora do include do tsconfig.json).
  // Regras type-aware exigiriam que o arquivo pertencesse a um projeto
  // TypeScript, o que não é o caso aqui — por isso só regras sintáticas.
  {
    files: ['*.config.ts', 'eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Bloco 4 (último): desliga as regras de estilo do ESLint que conflitam
  // com o Prettier.
  prettierConfig,
);
