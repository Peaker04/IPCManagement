import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const QUERY_HOOK_PATTERN = /^use[A-Za-z0-9_]*Query$/
const DATA_KEYS = new Set(['data', 'currentData'])
const ERROR_KEYS = new Set(['isError', 'error'])

/**
 * P1.9 — chặn tái phạm H7: hook RTK Query bị destructure lấy `data`/`currentData`
 * nhưng bỏ `isError`, khiến lỗi API bị hoá trang thành "chưa có dữ liệu" ngay tại
 * màn hình ra quyết định mua/nấu/xuất.
 *
 * Cách sửa hợp lệ: destructure thêm `isError` (hoặc giữ nguyên object kết quả rồi
 * đọc `query.isError`), sau đó render `QueryErrorAlert` hoặc
 * `EmptyState variant="error"` thay vì empty state thường.
 */
const noSwallowedQueryError = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Đã đọc data của hook RTK Query thì phải đọc cả isError, tránh biến lỗi API thành empty state giả.',
    },
    schema: [],
    messages: {
      swallowed:
        '{{hook}} đang lấy "{{dataKey}}" nhưng bỏ qua "isError": khi API lỗi, màn hình sẽ hiển thị như "chưa có dữ liệu" và người dùng kết luận sai nghiệp vụ. Hãy destructure thêm isError (hoặc giữ nguyên object kết quả) rồi render QueryErrorAlert / EmptyState variant="error".',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern') return
        if (!node.init || node.init.type !== 'CallExpression') return
        if (node.init.callee.type !== 'Identifier') return

        const hook = node.init.callee.name
        if (!QUERY_HOOK_PATTERN.test(hook)) return

        let dataKey = null
        let hasErrorKey = false
        for (const property of node.id.properties) {
          // `...rest` có thể chứa isError nên không kết luận được, bỏ qua.
          if (property.type === 'RestElement') return
          if (property.computed || property.key.type !== 'Identifier') continue
          if (!dataKey && DATA_KEYS.has(property.key.name)) dataKey = property.key.name
          if (ERROR_KEYS.has(property.key.name)) hasErrorKey = true
        }

        if (!dataKey || hasErrorKey) return
        context.report({ node: node.id, messageId: 'swallowed', data: { hook, dataKey } })
      },
    }
  },
}

/**
 * Khi một query đã được phân loại bằng `toQueryView`, dữ liệu của query đó chỉ
 * được đọc từ nhánh `ready`. Tiếp tục dùng `query.data ?? []` ở cùng file sẽ
 * bỏ qua uninitialized/error/forbidden và tái tạo empty state giả.
 *
 * Rule chỉ khóa query đã opt-in để roadmap có thể migrate theo strangler,
 * không tạo một baseline warning mới cho toàn bộ code cũ.
 */
const noDirectQueryDataFallbackAfterClassification = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Query đã qua toQueryView không được tiếp tục coerce data trực tiếp thành mảng rỗng.',
    },
    schema: [],
    messages: {
      directFallback:
        '{{query}} đã được phân loại bằng toQueryView nhưng vẫn dùng data ?? []. Hãy đọc data từ nhánh ready để không biến uninitialized/error/forbidden thành empty.',
    },
  },
  create(context) {
    const adapterNames = new Set(['toQueryView'])
    const classifiedQueries = new Set()
    const fallbackNodes = []

    const unwrap = (node) => {
      let current = node
      while (current?.type === 'ChainExpression' || current?.type === 'TSAsExpression' || current?.type === 'TSNonNullExpression') {
        current = current.expression
      }
      return current
    }

    const getQueryDataRoot = (node) => {
      let current = unwrap(node)
      let readsQueryData = false

      while (current?.type === 'MemberExpression') {
        const propertyName = current.computed
          ? current.property.type === 'Literal' ? current.property.value : null
          : current.property.type === 'Identifier' ? current.property.name : null
        if (DATA_KEYS.has(propertyName)) readsQueryData = true
        current = unwrap(current.object)
      }

      return readsQueryData && current?.type === 'Identifier' ? current.name : null
    }

    return {
      ImportDeclaration(node) {
        if (typeof node.source.value !== 'string' || !node.source.value.endsWith('queryView')) return
        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') continue
          const importedName = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value
          if (importedName === 'toQueryView') adapterNames.add(specifier.local.name)
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !adapterNames.has(node.callee.name)) return
        const query = unwrap(node.arguments[0])
        if (query?.type === 'Identifier') classifiedQueries.add(query.name)
      },
      LogicalExpression(node) {
        if (node.operator !== '??' || node.right.type !== 'ArrayExpression') return
        const query = getQueryDataRoot(node.left)
        if (query) fallbackNodes.push({ node, query })
      },
      'Program:exit'() {
        for (const fallback of fallbackNodes) {
          if (!classifiedQueries.has(fallback.query)) continue
          context.report({
            node: fallback.node,
            messageId: 'directFallback',
            data: { query: fallback.query },
          })
        }
      },
    }
  },
}

const ipcPlugin = {
  rules: {
    'no-swallowed-query-error': noSwallowedQueryError,
    'no-direct-query-data-fallback-after-classification': noDirectQueryDataFallbackAfterClassification,
  },
}

/**
 * Màn hình ra quyết định mua / nấu / xuất: empty state giả ở đây trực tiếp gây
 * quyết định sai nên vi phạm là lỗi chặn. Phần còn lại của app đang ở mức cảnh
 * báo để dọn dần mà không làm gãy lint hiện có.
 */
const DECISION_SCREEN_FILES = [
  'src/features/projects/pages/**/*.{ts,tsx}',
  'src/features/projects/weekly-menu/**/*.{ts,tsx}',
  'src/features/workflow/pages/PurchasingPage.tsx',
  'src/features/workflow/pages/WarehousePage.tsx',
  'src/features/workflow/purchasing/**/*.{ts,tsx}',
  'src/features/workflow/warehouse/**/*.{ts,tsx}',
  'src/features/chef/**/*.{ts,tsx}',
]

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    plugins: { ipc: ipcPlugin },
    rules: {
      'ipc/no-swallowed-query-error': 'warn',
      'ipc/no-direct-query-data-fallback-after-classification': 'error',
    },
  },
  {
    files: DECISION_SCREEN_FILES,
    ignores: ['src/**/*.test.{ts,tsx}'],
    plugins: { ipc: ipcPlugin },
    rules: { 'ipc/no-swallowed-query-error': 'error' },
  },
])
