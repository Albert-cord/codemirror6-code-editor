import { useState } from "react";
import { MenuItem, Select, Stack } from "@mui/material";

import Editor, { languageType } from "./codeEditor";

import "./App.css";

function App() {
  const [value, setValue] = useState(`
/** 
 * 测试注释区域
 */
@DEFINE_BEGIN hwm 
// 表达式
if (last != null && last.accuHWM != null) {
  return last.accuHWM;
}
return shareDetail.orgAccuNav;
@END
@DEFINE_BEGIN acc
  return tradeConfirm.accuNav;
@END
// 业绩报酬
// 表达式
def addTwo(a, b) {
  return a + b;
}
addTwo(5, 2);
if (accu <= accuHWM) { // 小于高水位，不计提
   return 0;
} else {
   return util.round((accuHWM - accu) * rate, 2);
}
  `);
  const [lang, setLang] = useState<languageType>("mvel");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleLangChange = (event: any) => {
    setLang(event.target.value);
  };

  return (
    <Stack gap={2}>
      <h1>Codemirror 6 : Code Editor</h1>
      <Select
        labelId="demo-simple-select-label"
        id="demo-simple-select"
        value={lang}
        label="Select a Language"
        onChange={handleLangChange}
        sx={{
          background:'white'
        }}
      >
        <MenuItem value={'json'}>JSON</MenuItem>
        <MenuItem value={'html'}>HTML</MenuItem>
        <MenuItem value={'javascript'}>Javascript</MenuItem>
        <MenuItem value={'mvel'}>MVEL</MenuItem>
      </Select>
      <Editor
        language={lang}
        value={value}
        onChange={(val) => setValue(val)}
        height="65vh"
        width="80vw"
        key={lang}
      />
    </Stack>
  );
}

export default App;
