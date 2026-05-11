export function moduleStatus(moduleName: string, nextWork: string[]) {
  return {
    module: moduleName,
    status: "Đã sẵn sàng nền tảng",
    nextWork,
  };
}
