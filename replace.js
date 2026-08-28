const fs = require("fs");
const path = require("path");

function replaceInFile(filePath) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");
    let originalContent = content;
    content = content.replace(/SIMASEDA/g, "MINDSET");
    content = content.replace(/Simaseda/g, "Mindset");
    content = content.replace(/simaseda/g, "mindset");

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated ${filePath}`);
    }
  }
}

const filesToUpdate = [
  "src/routes/_authenticated/work-types.tsx",
  "src/routes/_authenticated/vendors.tsx",
  "src/routes/_authenticated/transactions/out.tsx",
  "src/routes/_authenticated/transactions/in.tsx",
  "src/routes/_authenticated/qr.tsx",
  "src/routes/_authenticated/profile.tsx",
  "src/routes/_authenticated/dashboard.tsx",
  "src/routes/login.tsx",
  "src/components/layout/AppSidebar.tsx",
  "src/components/layout/AppHeader.tsx",
  "SIMAKO_PRD_Implementation_Spec_v2.md",
  "index.html",
];

filesToUpdate.forEach((file) => {
  replaceInFile(path.join(__dirname, file));
});
console.log("Replacement complete.");
