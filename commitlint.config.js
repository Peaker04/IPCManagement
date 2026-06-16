/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type phải là một trong các loại sau
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Tính năng mới
        'fix',      // Sửa bug
        'docs',     // Chỉ thay đổi tài liệu
        'style',    // Format code, không thay đổi logic
        'refactor', // Tái cấu trúc code, không thêm tính năng/fix bug
        'perf',     // Cải thiện hiệu năng
        'test',     // Thêm/sửa test
        'chore',    // Cập nhật build, deps, config
        'ci',       // Thay đổi CI/CD
        'revert',   // Revert commit trước đó
        'hotfix',   // Sửa lỗi khẩn cấp trên production
      ],
    ],
    // Type phải viết thường
    'type-case': [2, 'always', 'lower-case'],
    // Type không được để trống
    'type-empty': [2, 'never'],
    // Subject không được để trống
    'subject-empty': [2, 'never'],
    // Subject không được kết thúc bằng dấu chấm
    'subject-full-stop': [2, 'never', '.'],
    // Subject không giới hạn case (hỗ trợ tiếng Việt)
    'subject-case': [0],
    // Header tối đa 100 ký tự
    'header-max-length': [2, 'always', 100],
    // Body cách header 1 dòng trống
    'body-leading-blank': [1, 'always'],
    // Footer cách body 1 dòng trống
    'footer-leading-blank': [1, 'always'],
  },
  // Hỗ trợ tiếng Việt trong commit message
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\w+)(?:\((.+)\))?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'subject'],
    },
  },
};
