const KEYWORD_ICONS = [
  { icon: "💻", keywords: ["lap trinh", "lập trình", "code", "cau truc du lieu", "cấu trúc dữ liệu", "giai thuat", "giải thuật", "oop", "phan mem", "phần mềm"] },
  { icon: "🌐", keywords: ["web", "mang", "mạng", "internet", "truyen thong", "truyền thông"] },
  { icon: "🗄️", keywords: ["co so du lieu", "cơ sở dữ liệu", "database", "sql", "data"] },
  { icon: "🤖", keywords: ["tri tue nhan tao", "trí tuệ nhân tạo", "ai", "machine learning", "hoc may", "học máy"] },
  { icon: "🔒", keywords: ["bao mat", "bảo mật", "an toan thong tin", "an toàn thông tin", "security"] },
  { icon: "⚙️", keywords: ["he dieu hanh", "hệ điều hành", "ki thuat", "kỹ thuật", "nhung", "nhúng"] },
  { icon: "⚡", keywords: ["dien", "điện", "mach", "mạch", "dien tu", "điện tử"] },
  { icon: "📈", keywords: ["kinh te", "kinh tế", "quan tri", "quản trị", "marketing", "tai chinh", "tài chính"] },
  { icon: "📚", keywords: ["toan", "toán", "ly", "lý", "hoa", "hóa", "sinh", "van", "văn", "su", "sử", "dia", "địa"] },
  { icon: "🌍", keywords: ["anh van", "anh", "tieng anh", "tiếng anh", "ngoai ngu", "ngoại ngữ"] },
  { icon: "🎨", keywords: ["do hoa", "đồ họa", "thiet ke", "thiết kế", "my thuat", "mỹ thuật"] },
];

const normalize = (value) => String(value || "").trim().toLowerCase();

const inferSubjectIcon = (subjectName) => {
  const value = normalize(subjectName);
  if (!value) return "📚";

  const matched = KEYWORD_ICONS.find((entry) => entry.keywords.some((keyword) => value.includes(keyword)));
  return matched?.icon || "📚";
};

module.exports = {
  inferSubjectIcon,
};
