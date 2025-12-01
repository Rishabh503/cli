import { generateObject } from "ai";
import chalk from "chalk";
import { z } from "zod";  

import fs from 'fs/promises';
import path from 'path';
import yoctoSpinner from "yocto-spinner";

const ApplicationSchema = z.object({
  folderName: z.string().describe("Kebab-case folder name for the app"),
  description: z.string().describe("Brief description of what was created"),
  files: z.array(
    z.object({
      path: z.string().describe("Relative file path (eg src/App.jsx)"),
      content: z.string().describe("complete file content"),
    }).describe("All files needed for the application")
  ),
  setUpCommands: z.array(  
    z.string().describe("bash commands to setup and run eg(npm install, npm run dev)")
  ),
  dependencies: z
    .string()  // Changed from z.record(z.string())
    .optional()
    .describe("npm dependencies as JSON string with versions, e.g. {\"react\": \"^18.0.0\"}"),
});

function printSystem(message) {
  console.log(message);
}

function displayFileTree(files, folderName) {
  printSystem(chalk.cyan("\n Project Structure:"));
  printSystem(chalk.white(`\n ${folderName}/`));

  const filesByDir = {};
  files.forEach((file) => {
    const parts = file.path.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(parts[parts.length - 1]);
  });

  Object.keys(filesByDir)
    .sort()
    .forEach((dir) => {
      if (dir) {
        printSystem(chalk.white(`├── ${dir}/`));
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.white(`│   └── ${file}`));
        });
      } else {
        filesByDir[dir].forEach((file) => {
          printSystem(chalk.white(`└── ${file}`));
        });
      }
    });
}

// const instructions = ;


async function createApplicationFiles(baseDir, folderName,files ){
    const appDir=path.join(baseDir,folderName)

    await fs.mkdir(appDir,{recursive:true});
    printSystem(chalk.cyan(`\n Created Directory : ${folderName}`))

    for(const file of files){
        const filePath=path.join(appDir,file.path);
        const fileDir=path.dirname(filePath)

        await fs.mkdir(fileDir,{recursive:true});
        await fs.writeFile(filePath,file.content,'utf8');
        printSystem(chalk.green(`${file.path}`))
    }

    return appDir;
}

export async function generateApplication(
  description,
  aiService,
  cwd = process.cwd()
) {
  try {
    printSystem(
      chalk.cyan("\n Agent Mode : Generation of your app has started")
    );
    printSystem(chalk.gray(`Request: ${description}`));

    printSystem(chalk.magenta("-_- Agent Respone"));
 const spinner = yoctoSpinner({
    text: "AI is thinking...",
    color: "cyan",
  }).start();
    const  result  = await generateObject({
      model: aiService.model,
      schema: ApplicationSchema,
      prompt: `Create a complete, production-ready application for: ${description}

CRITICAL REQUIREMENTS:
1. Generate ALL files needed for the application to run
2. Include package.json with ALL dependencies and correct versions
3. Include README.md with setup instructions
4. Include configuration files (.gitignore, etc.)
5. Write clean, well-commented, production-ready code
6. Include error handling and input validation
7. Use modern JavaScript/TypeScript best practices
8. Make sure all imports and paths are correct
9. NO PLACEHOLDERS - everything must be complete and working

Provide:
- A meaningful kebab-case folder name
- All necessary files with complete content
- Setup Commands (cd folder, npm install , npm run dev, etc)
-All dependecies with versions
`,
    });

     const application=result.object

    printSystem(chalk.green(`\n Generated : ${application.folderName}`));
    printSystem(chalk.gray(`\n Description : ${application.description}`));

    if (application.files.length === 0) {
      throw new Error("no files were generated");
    }

    displayFileTree(application.files, application.folderName);

    printSystem(chalk.cyan("/n Creating files"));

    const appDir = await createApplicationFiles(
      cwd,
      application.folderName,
      application.files
    );

    // Display results
    printSystem(chalk.green.bold("\n ✨ Application created successfully!\n"));
    printSystem(chalk.cyan(` 📂 Location: ${chalk.bold(appDir)}\n`));

    if (application.setUpCommands.length > 0) {
      printSystem(chalk.cyan(" ➡️ Next Steps:\n"));
      printSystem(chalk.white("```bash"));
      application.setUpCommands.forEach((cmd) => {
        printSystem(chalk.white(cmd));
      });
      printSystem(chalk.white("```\n"));
    }

    return {
      folderName: application.folderName,
      appDir,
      files:application.files.map(f=>f.path),
      commands:application.setUpCommands,
      success:true
    };
  } catch (error) {
    printSystem(chalk.red(`\n Error Generating Application : ${error.message}`))
  }
}
