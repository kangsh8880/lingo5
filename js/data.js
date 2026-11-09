/* 5개국어 학습카드 - 기본 문장 데이터
 * 형식: [카테고리, 한국어, 베트남어, 영어, 중국어, 병음, 일본어, 로마자]
 */
const LANGS = {
  vi: { self: 'Tiếng Việt', name: '베트남어', short: 'VI', flag: '🇻🇳' },
  en: { self: 'English', name: '영어',     short: 'EN', flag: '🇺🇸' },
  zh: { self: '中文', name: '중국어',   short: 'ZH', flag: '🇨🇳' },
  ja: { self: '日本語', name: '일본어',   short: 'JA', flag: '🇯🇵' },
  ko: { self: '한국어', name: '한국어',   short: 'KO', flag: '🇰🇷' }
};

const CATS = {
  greet: '인사·기본',
  work: '업무·현장',
  food: '식당',
  move: '이동·교통',
  shop: '쇼핑',
  daily: '일상',
  custom: '내 문장'
};

const RAW_PHRASES = [
  ['greet','안녕하세요','Xin chào','Hello','你好','nǐ hǎo','こんにちは','konnichiwa'],
  ['greet','감사합니다','Cảm ơn','Thank you','谢谢','xièxie','ありがとうございます','arigatō gozaimasu'],
  ['greet','죄송합니다','Xin lỗi','I\'m sorry','对不起','duìbuqǐ','すみません','sumimasen'],
  ['greet','처음 뵙겠습니다','Rất vui được gặp bạn','Nice to meet you','很高兴认识你','hěn gāoxìng rènshi nǐ','はじめまして','hajimemashite'],
  ['greet','안녕히 가세요','Tạm biệt','Goodbye','再见','zàijiàn','さようなら','sayōnara'],
  ['greet','요즘 잘 지내세요?','Dạo này bạn có khỏe không?','How have you been lately?','你最近好吗？','nǐ zuìjìn hǎo ma?','最近お元気ですか？','saikin ogenki desu ka?'],
  ['greet','저는 한국 사람입니다','Tôi là người Hàn Quốc','I am Korean','我是韩国人','wǒ shì Hánguó rén','私は韓国人です','watashi wa kankokujin desu'],
  ['greet','괜찮아요','Không sao đâu','It\'s okay','没关系','méi guānxi','大丈夫です','daijōbu desu'],
  ['greet','다시 한번 말씀해 주세요','Xin nói lại một lần nữa','Please say that again','请再说一遍','qǐng zài shuō yí biàn','もう一度言ってください','mō ichido itte kudasai'],
  ['greet','천천히 말씀해 주세요','Xin nói chậm lại','Please speak slowly','请说慢一点','qǐng shuō màn yìdiǎn','ゆっくり話してください','yukkuri hanashite kudasai'],

  ['work','회의는 몇 시에 시작해요?','Cuộc họp bắt đầu lúc mấy giờ?','What time does the meeting start?','会议几点开始？','huìyì jǐ diǎn kāishǐ?','会議は何時に始まりますか？','kaigi wa nanji ni hajimarimasu ka?'],
  ['work','오늘 생산 목표는 얼마예요?','Mục tiêu sản xuất hôm nay là bao nhiêu?','What is today\'s production target?','今天的生产目标是多少？','jīntiān de shēngchǎn mùbiāo shì duōshao?','今日の生産目標はいくつですか？','kyō no seisan mokuhyō wa ikutsu desu ka?'],
  ['work','설비가 멈췄어요','Máy bị dừng rồi','The equipment has stopped','设备停了','shèbèi tíng le','設備が止まりました','setsubi ga tomarimashita'],
  ['work','불량 원인을 확인해 주세요','Hãy kiểm tra nguyên nhân lỗi','Please check the cause of the defect','请确认不良原因','qǐng quèrèn bùliáng yuányīn','不良の原因を確認してください','furyō no gen\'in o kakunin shite kudasai'],
  ['work','안전이 최우선입니다','An toàn là trên hết','Safety comes first','安全第一','ānquán dì yī','安全第一です','anzen daiichi desu'],
  ['work','보고서를 내일까지 보내 주세요','Vui lòng gửi báo cáo trước ngày mai','Please send the report by tomorrow','请明天之前发送报告','qǐng míngtiān zhīqián fāsòng bàogào','明日までに報告書を送ってください','ashita made ni hōkokusho o okutte kudasai'],
  ['work','이 문제는 누가 담당해요?','Ai phụ trách vấn đề này?','Who is in charge of this issue?','这个问题谁负责？','zhège wèntí shéi fùzé?','この問題は誰の担当ですか？','kono mondai wa dare no tantō desu ka?'],
  ['work','작업을 시작합시다','Chúng ta bắt đầu làm việc nhé','Let\'s start working','我们开始工作吧','wǒmen kāishǐ gōngzuò ba','作業を始めましょう','sagyō o hajimemashō'],
  ['work','수고하셨습니다','Mọi người vất vả rồi','Thank you for your hard work','辛苦了','xīnkǔ le','お疲れ様でした','otsukaresama deshita'],
  ['work','내일 다시 확인하겠습니다','Ngày mai tôi sẽ kiểm tra lại','I will check again tomorrow','我明天再确认','wǒ míngtiān zài quèrèn','明日もう一度確認します','ashita mō ichido kakunin shimasu'],
  ['work','재고가 부족합니다','Hàng tồn kho không đủ','We are short on inventory','库存不足','kùcún bùzú','在庫が足りません','zaiko ga tarimasen'],
  ['work','일정을 앞당길 수 있어요?','Có thể đẩy nhanh tiến độ không?','Can we move the schedule up?','能提前日程吗？','néng tíqián rìchéng ma?','日程を早められますか？','nittei o hayameraremasu ka?'],

  ['food','메뉴판 주세요','Cho tôi xem thực đơn','May I see the menu?','请给我菜单','qǐng gěi wǒ càidān','メニューをください','menyū o kudasai'],
  ['food','이거 주세요','Cho tôi cái này','I\'ll have this','我要这个','wǒ yào zhège','これをください','kore o kudasai'],
  ['food','맵지 않게 해 주세요','Đừng làm cay nhé','Not spicy, please','请不要做辣的','qǐng búyào zuò là de','辛くしないでください','karaku shinaide kudasai'],
  ['food','계산해 주세요','Tính tiền giùm tôi','Check, please','买单','mǎidān','お会計をお願いします','okaikei o onegai shimasu'],
  ['food','물 한 잔 주세요','Cho tôi một ly nước','A glass of water, please','请给我一杯水','qǐng gěi wǒ yì bēi shuǐ','水を一杯ください','mizu o ippai kudasai'],
  ['food','정말 맛있어요','Ngon quá','It\'s really delicious','真好吃','zhēn hǎochī','とてもおいしいです','totemo oishii desu'],
  ['food','고수는 빼 주세요','Đừng cho rau mùi','No cilantro, please','请不要放香菜','qǐng búyào fàng xiāngcài','パクチー抜きでお願いします','pakuchī nuki de onegai shimasu'],
  ['food','포장해 주세요','Cho tôi mang về','To go, please','请打包','qǐng dǎbāo','持ち帰りでお願いします','mochikaeri de onegai shimasu'],

  ['move','화장실이 어디예요?','Nhà vệ sinh ở đâu?','Where is the restroom?','洗手间在哪里？','xǐshǒujiān zài nǎlǐ?','トイレはどこですか？','toire wa doko desu ka?'],
  ['move','공항까지 가 주세요','Cho tôi đến sân bay','To the airport, please','请去机场','qǐng qù jīchǎng','空港までお願いします','kūkō made onegai shimasu'],
  ['move','여기서 세워 주세요','Dừng ở đây giùm tôi','Please stop here','请在这里停车','qǐng zài zhèlǐ tíngchē','ここで止めてください','koko de tomete kudasai'],
  ['move','얼마나 걸려요?','Mất bao lâu?','How long does it take?','需要多长时间？','xūyào duō cháng shíjiān?','どのくらいかかりますか？','dono kurai kakarimasu ka?'],
  ['move','길을 잃었어요','Tôi bị lạc đường','I\'m lost','我迷路了','wǒ mílù le','道に迷いました','michi ni mayoimashita'],
  ['move','가장 가까운 역이 어디예요?','Ga gần nhất ở đâu?','Where is the nearest station?','最近的车站在哪里？','zuì jìn de chēzhàn zài nǎlǐ?','一番近い駅はどこですか？','ichiban chikai eki wa doko desu ka?'],
  ['move','이것은 호텔 주소예요','Đây là địa chỉ khách sạn','This is the hotel address','这是酒店地址','zhè shì jiǔdiàn dìzhǐ','これはホテルの住所です','kore wa hoteru no jūsho desu'],
  ['move','오른쪽으로 가 주세요','Rẽ phải giùm tôi','Please turn right','请往右转','qǐng wǎng yòu zhuǎn','右に曲がってください','migi ni magatte kudasai'],

  ['shop','이거 얼마예요?','Cái này bao nhiêu tiền?','How much is this?','这个多少钱？','zhège duōshao qián?','これはいくらですか？','kore wa ikura desu ka?'],
  ['shop','너무 비싸요','Đắt quá','It\'s too expensive','太贵了','tài guì le','高すぎます','takasugimasu'],
  ['shop','좀 깎아 주세요','Bớt cho tôi một chút','Please give me a discount','便宜一点吧','piányi yìdiǎn ba','少し安くしてください','sukoshi yasuku shite kudasai'],
  ['shop','카드 결제 돼요?','Có trả bằng thẻ được không?','Can I pay by card?','可以刷卡吗？','kěyǐ shuākǎ ma?','カードで払えますか？','kādo de haraemasu ka?'],
  ['shop','다른 색 있어요?','Có màu khác không?','Do you have another color?','有别的颜色吗？','yǒu bié de yánsè ma?','他の色はありますか？','hoka no iro wa arimasu ka?'],
  ['shop','입어 봐도 돼요?','Tôi mặc thử được không?','May I try it on?','可以试穿吗？','kěyǐ shìchuān ma?','試着してもいいですか？','shichaku shite mo ii desu ka?'],
  ['shop','그냥 구경하는 거예요','Tôi chỉ xem thôi','I\'m just looking','我只是看看','wǒ zhǐshì kànkan','見ているだけです','mite iru dake desu'],
  ['shop','영수증 주세요','Cho tôi hóa đơn','Receipt, please','请给我收据','qǐng gěi wǒ shōujù','レシートをください','reshīto o kudasai'],

  ['daily','지금 몇 시예요?','Bây giờ là mấy giờ?','What time is it now?','现在几点？','xiànzài jǐ diǎn?','今何時ですか？','ima nanji desu ka?'],
  ['daily','오늘 날씨가 좋네요','Hôm nay trời đẹp quá','The weather is nice today','今天天气真好','jīntiān tiānqì zhēn hǎo','今日はいい天気ですね','kyō wa ii tenki desu ne'],
  ['daily','도와주세요','Giúp tôi với','Please help me','请帮帮我','qǐng bāngbang wǒ','助けてください','tasukete kudasai'],
  ['daily','잘 모르겠어요','Tôi không biết rõ','I\'m not sure','我不太清楚','wǒ bú tài qīngchu','よくわかりません','yoku wakarimasen'],
  ['daily','이해했어요','Tôi hiểu rồi','I understand','我明白了','wǒ míngbai le','わかりました','wakarimashita'],
  ['daily','잠시만 기다려 주세요','Xin chờ một chút','Please wait a moment','请稍等','qǐng shāo děng','少々お待ちください','shōshō omachi kudasai'],
  ['daily','내일 봐요','Hẹn gặp lại ngày mai','See you tomorrow','明天见','míngtiān jiàn','また明日','mata ashita'],
  ['daily','주말에 뭐 해요?','Cuối tuần bạn làm gì?','What are you doing this weekend?','周末你做什么？','zhōumò nǐ zuò shénme?','週末は何をしますか？','shūmatsu wa nani o shimasu ka?'],
  ['daily','배고파요','Tôi đói bụng','I\'m hungry','我饿了','wǒ è le','お腹が空きました','onaka ga sukimashita'],
  ['daily','피곤해요','Tôi mệt','I\'m tired','我累了','wǒ lèi le','疲れました','tsukaremashita'],
  ['daily','전화번호가 뭐예요?','Số điện thoại của bạn là gì?','What is your phone number?','你的电话号码是多少？','nǐ de diànhuà hàomǎ shì duōshao?','電話番号は何ですか？','denwa bangō wa nan desu ka?'],
  ['daily','축하합니다','Chúc mừng','Congratulations','恭喜','gōngxǐ','おめでとうございます','omedetō gozaimasu'],
  ['daily','생일 축하해요','Chúc mừng sinh nhật','Happy birthday','生日快乐','shēngrì kuàilè','お誕生日おめでとう','otanjōbi omedetō'],
  ['daily','건배!','Một, hai, ba, dô!','Cheers!','干杯！','gānbēi!','乾杯！','kanpai!']
];

const PHRASES = RAW_PHRASES.map((r, i) => ({
  id: 'p' + String(i + 1).padStart(3, '0'),
  cat: r[0], ko: r[1], vi: r[2], en: r[3], zh: r[4], ja: r[6],
  pron: { zh: r[5], ja: r[7] }
}));
