import json
import sys
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))

payload_path, output_path = sys.argv[1], sys.argv[2]
with open(payload_path, 'r', encoding='utf-8') as source:
    data = json.load(source)

page_width, page_height = A4
pdf = canvas.Canvas(output_path, pagesize=A4)
font = 'STSong-Light'
pdf.setTitle('AI auto 分享员收入证明')
pdf.setFont(font, 20)
pdf.drawCentredString(page_width / 2, page_height - 28 * mm, 'AI auto 分享员收入证明')
pdf.setFont(font, 9)
pdf.setFillColor(HexColor('#64748b'))
pdf.drawCentredString(page_width / 2, page_height - 35 * mm, '本证明基于平台已记录的佣金与核销数据生成')

pdf.setFillColor(HexColor('#0f172a'))
pdf.setFont(font, 11)
y = page_height - 52 * mm
for label, value in [('分享员', data['agentName']), ('统计期间', data['period']), ('生成时间', data['generatedAt'])]:
    pdf.drawString(22 * mm, y, label)
    pdf.drawString(52 * mm, y, value)
    y -= 9 * mm

pdf.setFillColor(HexColor('#eff6ff'))
pdf.roundRect(18 * mm, y - 32 * mm, page_width - 36 * mm, 28 * mm, 3 * mm, fill=1, stroke=0)
pdf.setFillColor(HexColor('#1d4ed8'))
pdf.setFont(font, 10)
pdf.drawString(28 * mm, y - 13 * mm, '佣金总收入')
pdf.setFont(font, 22)
pdf.drawString(28 * mm, y - 24 * mm, '¥ ' + data['summary']['totalIncome'])
pdf.setFont(font, 10)
pdf.drawString(100 * mm, y - 13 * mm, '核销数')
pdf.setFont(font, 18)
pdf.drawString(100 * mm, y - 24 * mm, str(data['summary']['redemptions']))
pdf.setFont(font, 10)
pdf.drawString(140 * mm, y - 13 * mm, '平台扣费')
pdf.setFont(font, 18)
pdf.drawString(140 * mm, y - 24 * mm, '¥ ' + data['summary']['platformFee'])

y -= 48 * mm
pdf.setFillColor(HexColor('#0f172a'))
pdf.setFont(font, 13)
pdf.drawString(18 * mm, y, '月度收入明细')
y -= 10 * mm
headers = [('月份', 20), ('佣金收入', 72), ('平台扣费', 120), ('核销数', 165)]
pdf.setFillColor(HexColor('#f1f5f9'))
pdf.rect(18 * mm, y - 7 * mm, page_width - 36 * mm, 9 * mm, fill=1, stroke=0)
pdf.setFillColor(HexColor('#334155')); pdf.setFont(font, 9)
for text, x in headers: pdf.drawString(x * mm, y - 4 * mm, text)
y -= 12 * mm
for row in data['months']:
    if y < 42 * mm:
        pdf.showPage(); y = page_height - 25 * mm
    pdf.setFillColor(HexColor('#0f172a')); pdf.setFont(font, 9)
    pdf.drawString(20 * mm, y, row['month'])
    pdf.drawString(72 * mm, y, '¥ ' + row['income'])
    pdf.drawString(120 * mm, y, '¥ ' + row['platformFee'])
    pdf.drawString(165 * mm, y, str(row['redemptions']))
    pdf.setStrokeColor(HexColor('#e2e8f0')); pdf.line(18 * mm, y - 3 * mm, page_width - 18 * mm, y - 3 * mm)
    y -= 8 * mm

pdf.setStrokeColor(HexColor('#dc2626')); pdf.setLineWidth(1.2)
pdf.circle(page_width - 42 * mm, 42 * mm, 16 * mm, stroke=1, fill=0)
pdf.setFillColor(HexColor('#dc2626')); pdf.setFont(font, 8)
pdf.drawCentredString(page_width - 42 * mm, 44 * mm, 'AI auto')
pdf.drawCentredString(page_width - 42 * mm, 37 * mm, '收入证明专用章')
pdf.setFillColor(HexColor('#64748b')); pdf.setFont(font, 8)
pdf.drawString(18 * mm, 31 * mm, '税务申报及缴纳义务由分享员自行承担。本文件不构成税务建议或完税凭证。')
pdf.drawString(18 * mm, 24 * mm, '如需核验，请联系 AI auto 平台运营人员，并提供本证明生成时间与分享员编号。')
pdf.save()
