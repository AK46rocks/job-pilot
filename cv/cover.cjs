const fs=require("fs");const{Document,Packer,Paragraph,TextRun,AlignmentType,BorderStyle,ExternalHyperlink}=require("docx");
const F="Calibri",S=22,A="1F3864";const r=(t,o={})=>new TextRun({text:t,font:F,size:S,...o});
const l=(t,u)=>new ExternalHyperlink({link:u,children:[new TextRun({text:t,font:F,size:S-2,color:A,underline:{}})]});
const p=t=>new Paragraph({spacing:{after:200,line:300},alignment:AlignmentType.JUSTIFIED,children:[r(t)]});
const c=JSON.parse(fs.readFileSync(process.argv[2]));
const ch=[new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[r("ADITYA KUNDURKAR",{bold:true,size:34,color:A})]}),
new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:300},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:A,space:6}},children:[r("adityakundurkar24@gmail.com | +44 7586 246488 | Coventry, United Kingdom | ",{size:S-2}),l("LinkedIn","https://www.linkedin.com/in/aditya-kundurkar"),r(" | ",{size:S-2}),l("GitHub","https://github.com/AK46rocks")]}),
new Paragraph({spacing:{after:240},children:[r(c.date)]}),new Paragraph({spacing:{after:240},children:[r(c.greeting)]}),
new Paragraph({spacing:{after:240},children:[r(c.role,{bold:true})]}),...c.paras.map(p),
new Paragraph({spacing:{after:60},children:[r("Kind regards,")]}),new Paragraph({children:[r("Aditya Kundurkar",{bold:true})]})];
const d=new Document({creator:"Aditya Kundurkar",title:"Aditya Kundurkar Cover Letter",styles:{default:{document:{run:{font:F,size:S}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:1100,right:1100}}},children:ch}]});
Packer.toBuffer(d).then(b=>fs.writeFileSync(c.out+".docx",b));
