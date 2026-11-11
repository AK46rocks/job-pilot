const fs=require("fs");
const {Document,Packer,Paragraph,TextRun,TabStopType,AlignmentType,LevelFormat,BorderStyle,ExternalHyperlink}=require("docx");
const cfg=JSON.parse(fs.readFileSync(process.argv[2]));
const FONT="Calibri",SIZE=Number(process.env.CV_SIZE||19),TW=11906-2*680,ACCENT="1F3864";
const run=(t,o={})=>new TextRun({text:t,font:FONT,size:SIZE,...o});
const link=(t,u)=>new ExternalHyperlink({link:u,children:[new TextRun({text:t,font:FONT,size:SIZE,color:ACCENT,underline:{}})]});
const section=t=>new Paragraph({spacing:{before:110,after:40},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:ACCENT,space:1}},children:[run(t.toUpperCase(),{bold:true,size:SIZE+2,color:ACCENT})]});
const roleLine=(l,r,b=60)=>new Paragraph({spacing:{before:b,after:0},tabStops:[{type:TabStopType.RIGHT,position:TW}],children:[run(l,{bold:true,size:SIZE+1}),...(r?[run("\t"+r,{bold:true})]:[])]});
const sub=t=>new Paragraph({spacing:{after:20},children:[run(t,{italics:true})]});
const proj=(n,s)=>new Paragraph({spacing:{before:50,after:10},children:[run(n,{bold:true}),run(" ("+s+")",{italics:true})]});
const bullet=t=>new Paragraph({numbering:{reference:"bullets",level:0},spacing:{after:10,line:240},children:[run(t)]});
const lab=(l,t)=>new Paragraph({numbering:{reference:"bullets",level:0},spacing:{after:10,line:240},children:[run(l+": ",{bold:true}),run(t)]});
const gh=s=>new Paragraph({spacing:{after:20},children:[run(s,{italics:true}),run(" | "),link("GitHub","https://github.com/AK46rocks/cinema-agent")]});
const ch=[
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[run("ADITYA KUNDURKAR",{bold:true,size:34,color:ACCENT})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[run(cfg.title,{bold:true,size:SIZE+2})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:20},children:[run("adityakundurkar24@gmail.com | +44 7586 246488 | Coventry, United Kingdom | "),link("LinkedIn","https://www.linkedin.com/in/aditya-kundurkar"),run(" | "),link("GitHub","https://github.com/AK46rocks")]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:40},children:[run(cfg.rtw,{italics:true})]}),
 section("Profile"),
 new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{after:20,line:240},children:[run(cfg.profile)]})];
for(const s of cfg.sections){ch.push(section(s.name));for(const it of s.items){const[k,...a]=it;
 ch.push(k=="role"?roleLine(a[0],a[1],a[2]):k=="sub"?sub(a[0]):k=="proj"?proj(a[0],a[1]):k=="b"?bullet(a[0]):k=="gh"?gh(a[0]):k=="s"?lab(a[0],a[1]):new Paragraph({children:[run(a[0])]}));}}
const doc=new Document({creator:"Aditya Kundurkar",title:"Aditya Kundurkar CV",styles:{default:{document:{run:{font:FONT,size:SIZE}}}},
 numbering:{config:[{reference:"bullets",levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:260,hanging:180}}}}]}]},
 sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:500,bottom:450,left:680,right:680}}},children:ch}]});
Packer.toBuffer(doc).then(b=>fs.writeFileSync(cfg.out+".docx",b));
