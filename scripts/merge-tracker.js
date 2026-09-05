const fs = require('fs');
const path = require('path');

// Target file can be provided as an argument, defaults to context/progress-tracker.md
const targetFile = process.argv[2] || path.join(process.cwd(), 'context/progress-tracker.md');

if (!fs.existsSync(targetFile)) {
  console.error(`File not found: ${targetFile}`);
  process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// Regex to find git conflict markers
const conflictRegex = /<<<<<<<[^\n]*\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>>[^\n]*(?:\n|$)/g;

let conflictCount = 0;

content = content.replace(conflictRegex, (match, current, incoming) => {
  conflictCount++;
  
  const currentLines = current.split('\n');
  const incomingLines = incoming.split('\n');
  
  const mergedLines = [...currentLines];
  
  // Normalize helper to compare lines while ignoring completion status [x] vs [ ]
  const normalize = (line) => line.trim().toLowerCase().replace(/\[[x\s]\]/g, '[]');
  
  const currentNormalized = new Map();
  currentLines.forEach((line, index) => {
    if (line.trim()) {
      currentNormalized.set(normalize(line), index);
    }
  });
  
  incomingLines.forEach(line => {
    if (!line.trim()) return; // skip empty lines from incoming if they are just spacing
    
    const normLine = normalize(line);
    if (!currentNormalized.has(normLine)) {
      // Line is unique, add it
      mergedLines.push(line);
    } else {
      // Line exists, but check if we need to update checkbox (prefer [x] over [ ])
      const index = currentNormalized.get(normLine);
      if (/\[x\]/i.test(line) && /\[ \]/i.test(mergedLines[index])) {
        mergedLines[index] = line;
      }
    }
  });
  
  // Clean up trailing empty lines within the block
  while (mergedLines.length > 0 && mergedLines[mergedLines.length - 1].trim() === '') {
    mergedLines.pop();
  }
  
  return mergedLines.join('\n') + '\n';
});

if (conflictCount > 0) {
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log(`Successfully resolved ${conflictCount} conflict(s) in ${targetFile}`);
} else {
  console.log(`No conflicts found in ${targetFile}`);
}
