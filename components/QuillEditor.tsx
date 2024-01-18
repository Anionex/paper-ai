"use client";

import React, { useState, useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

// 一些工具函数导入
import getArxivPapers from "./GetArxiv";
import getSemanticPapers from "./GetSemantic";
import sendMessageToOpenAI from "./chatAI";
import {
  getTextBeforeCursor,
  updateBracketNumbersInDelta,
  convertToSuperscript,
} from "@/utils/others/quillutils";
import ReferenceList from "./ReferenceList";
//类型声明
import { Reference } from "@/utils/global";

const toolbarOptions = [
  ["bold", "italic", "underline", "strike"], // 加粗、斜体、下划线和删除线
  ["blockquote", "code-block"], // 引用和代码块

  [{ header: 1 }, { header: 2 }], // 标题
  [{ list: "ordered" }, { list: "bullet" }], // 列表
  [{ script: "sub" }, { script: "super" }], // 上标/下标
  [{ indent: "-1" }, { indent: "+1" }], // 缩进
  [{ direction: "rtl" }], // 文字方向

  [{ size: ["small", false, "large", "huge"] }], // 字体大小
  [{ header: [1, 2, 3, 4, 5, 6, false] }],

  [{ color: [] }, { background: [] }], // 字体颜色和背景色
  [{ font: [] }], // 字体
  [{ align: [] }], // 对齐方式

  ["clean"], // 清除格式按钮
];

const QEditor = () => {
  const [quill, setQuill] = useState(null);
  //询问ai，用户输入
  const [userInput, setUserInput] = useState("");

  // 初始化 Quill 编辑器
  const isMounted = useRef(false);
  const editor = useRef(null);
  // 选择论文来源
  const [selectedSource, setSelectedSource] = useState("semanticScholar"); // 默认选项

  useEffect(() => {
    if (!isMounted.current) {
      editor.current = new Quill("#editor", {
        // modules: {
        //   toolbar: toolbarOptions
        // },
        theme: "snow",
      });
      // 检查 localStorage 中是否有保存的内容
      const savedContent = localStorage.getItem("quillContent");
      if (savedContent) {
        // 设置编辑器的内容
        editor.current.root.innerHTML = savedContent;
      }

      isMounted.current = true;
      setQuill(editor.current);
    }
  }, []);

  useEffect(() => {
    if (quill) {
      // 设置监听器以处理内容变化
      quill.on("text-change", function (delta, oldDelta, source) {
        if (source === "user") {
          // 获取编辑器内容
          const content = quill.root.innerHTML; // 或 quill.getText()，或 quill.getContents()

          // 保存到 localStorage
          localStorage.setItem("quillContent", content);
          setTimeout(() => {
            convertToSuperscript(quill);
          }, 0); // 延迟 0 毫秒，即将函数放入事件队列的下一个循环中执行,不然就会因为在改变文字触发整个函数时修改文本内容造成无法找到光标位置
        }
      });
    }
  }, [quill]);

  //更新参考文献的部分
  const [references, setReferences] = useState<Reference[]>([]);

  const addReference = (newReference: Reference) => {
    setReferences([...references, newReference]);
  };

  const removeReference = (index: number) => {
    setReferences(references.filter((_, i) => i !== index));
  };
  // function updateBracketNumbers(text) {
  //   let currentNumber = 1;
  //   const updatedText = text.replace(/\[\d+\]/g, () => `[${currentNumber++}]`);
  //   return updatedText;
  // }

  // 处理用户输入变化
  const handleInputChange = (event) => {
    setUserInput(event.target.value);
  };

  async function paper2AI(topic: string) {
    try {
      let rawData, dataString;
      if (selectedSource === "arxiv") {
        rawData = await getArxivPapers(topic);
        dataString = rawData
          .map((entry) => {
            addReference({
              url: entry.id,
              title: entry.title,
              year: entry.published,
              author: entry.author?.slice(0, 3).join(", "),
            });
            return `ID: ${entry.id}\nTime: ${entry.published}\nTitle: ${entry.title}\nSummary: ${entry.summary}\n\n`;
          })
          .join("");
      } else if (selectedSource === "semanticScholar") {
        rawData = await getSemanticPapers(topic, "2015-2023");
        dataString = rawData
          .map((entry) => {
            addReference({
              url: entry.paperId,
              title: entry.title,
              year: entry.published,
              author: entry.authors?.slice(0, 3).join(", "),
              venue: entry.venue,
            });
            return `Time: ${entry.year}\nTitle: ${entry.title}\nSummary: ${entry.abstract}\n\n`;
          })
          .join("");
      }
      // 其他数据源的处理

      sendMessageToOpenAI(dataString, quill, getTextBeforeCursor(quill), topic);
    } catch (error) {
      console.error("Error fetching data:", error);
      // 错误处理
    }
  }

  // 插入论文信息
  const insertPapers = async (topic: string) => {
    const rawData = await getArxivPapers(topic);
    const dataString = rawData
      .map((entry) => {
        return `ID: ${entry.id}\nPublished: ${entry.published}\nTitle: ${entry.title}\nSummary: ${entry.summary}\n\n`;
      })
      .join("");
    quill.insertText(quill.getLength(), dataString);
  };

  return (
    <div>
      <div id="Qtoolbar" className="space-y-2">
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          className="shadow appearance-none border rounded py-2 px-3 text-grey-darker"
        />
        {/*<button
          onClick={handleAIClick}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Insert AI Text
        </button>*/}
        <button
          onClick={() => insertPapers(userInput || "robot")}
          className="bg-indigo-500 hover:bg-indigo-700 text-black font-bold py-2 px-4 rounded"
        >
          Insert Papers
        </button>
        <button
          onClick={() => paper2AI(userInput || "robot")}
          className="bg-red-500 hover:bg-red-700 text-black font-bold py-2 px-4 rounded"
        >
          Paper2AI
        </button>
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
        >
          <option value="arxiv">arxiv</option>
          <option value="semanticScholar">semantic scholar</option>
          {/* 其他来源网站 */}
        </select>
      </div>
      <div
        id="editor"
        style={{
          height: "500px",
          width: "600px",
          minHeight: "150px", // 注意驼峰命名法
          maxHeight: "500px",
          overflowY: "auto", // overflow-y -> overflowY
          border: "1px solid #ccc",
          padding: "10px",
        }}
      ></div>
      <ReferenceList
        references={references}
        addReference={addReference}
        removeReference={removeReference}
      />
    </div>
  );
};

export default QEditor;