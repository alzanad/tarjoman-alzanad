const LANGUAGES = [
    { code: 'ar', name: 'العربية' },
    { code: 'af', name: 'الأفريقانية' }, { code: 'sq', name: 'الألبانية' }, { code: 'am', name: 'الأمهرية' },
    { code: 'hy', name: 'الأرمنية' }, { code: 'az', name: 'الأذربيجانية' },
    { code: 'eu', name: 'الباسكية' }, { code: 'be', name: 'البيلاروسية' }, { code: 'bn', name: 'البنغالية' },
    { code: 'bs', name: 'البوسنية' }, { code: 'bg', name: 'البلغارية' }, { code: 'ca', name: 'الكتالونية' },
    { code: 'ceb', name: 'السيبيوانية' }, { code: 'ny', name: 'الشيشيوا' }, { code: 'zh-CN', name: 'الصينية (مبسطة)' },
    { code: 'zh-TW', name: 'الصينية (تقليدية)' }, { code: 'co', name: 'الكورسيكية' }, { code: 'hr', name: 'الكرواتية' },
    { code: 'cs', name: 'التشيكية' }, { code: 'da', name: 'الدانمركية' }, { code: 'nl', name: 'الهولندية' },
    { code: 'en', name: 'الإنجليزية' }, { code: 'eo', name: 'الإسبرانتو' }, { code: 'et', name: 'الإستونية' },
    { code: 'tl', name: 'الفلبينية' }, { code: 'fi', name: 'الفنلندية' }, { code: 'fr', name: 'الفرنسية' },
    { code: 'fy', name: 'الفريزية' }, { code: 'gl', name: 'الجاليكية' }, { code: 'ka', name: 'الجورجية' },
    { code: 'de', name: 'الألمانية' }, { code: 'el', name: 'اليونانية' }, { code: 'gu', name: 'الغوجاراتية' },
    { code: 'ht', name: 'الكريولية الهايتية' }, { code: 'ha', name: 'الهوسا' }, { code: 'haw', name: 'لغة هاواي' },
    { code: 'iw', name: 'العبرية' }, { code: 'hi', name: 'الهندية' }, { code: 'hmn', name: 'الهمونغ' },
    { code: 'hu', name: 'المجرية' }, { code: 'is', name: 'الآيسلندية' }, { code: 'ig', name: 'الإيغبو' },
    { code: 'id', name: 'الإندونيسية' }, { code: 'ga', name: 'الأيرلندية' }, { code: 'it', name: 'الإيطالية' },
    { code: 'ja', name: 'اليابانية' }, { code: 'jw', name: 'الجاوية' }, { code: 'kn', name: 'الكانادا' },
    { code: 'kk', name: 'الكازاخستانية' }, { code: 'km', name: 'الخميرية' }, { code: 'rw', name: 'الكينيارواندا' },
    { code: 'ko', name: 'الكورية' }, { code: 'ku', name: 'الكردية' }, { code: 'ky', name: 'القيرغيزية' },
    { code: 'lo', name: 'اللاوية' }, { code: 'la', name: 'اللاتينية' }, { code: 'lv', name: 'اللاتفية' },
    { code: 'lt', name: 'الليتوانية' }, { code: 'lb', name: 'اللوكسمبورغية' }, { code: 'mk', name: 'المقدونية' },
    { code: 'mg', name: 'المالاجاشية' }, { code: 'ms', name: 'الملايو' }, { code: 'ml', name: 'المالايالامية' },
    { code: 'mt', name: 'المالطية' }, { code: 'mi', name: 'الماورية' }, { code: 'mr', name: 'الماراثية' },
    { code: 'mn', name: 'المنغولية' }, { code: 'my', name: 'البورمية' }, { code: 'ne', name: 'النيبالية' },
    { code: 'no', name: 'النرويجية' }, { code: 'or', name: 'الأوديا' }, { code: 'ps', name: 'الباشتو' },
    { code: 'fa', name: 'الفارسية' }, { code: 'pl', name: 'البولندية' }, { code: 'pt', name: 'البرتغالية' },
    { code: 'pa', name: 'البنجابية' }, { code: 'ro', name: 'الرومانية' }, { code: 'ru', name: 'الروسية' },
    { code: 'sm', name: 'الساموية' }, { code: 'gd', name: 'الغيلية الأسكتلندية' }, { code: 'sr', name: 'الصربية' },
    { code: 'st', name: 'السوتية' }, { code: 'sn', name: 'الشونا' }, { code: 'sd', name: 'السندية' },
    { code: 'si', name: 'السنهالية' }, { code: 'sk', name: 'السلوفاكية' }, { code: 'sl', 'name': 'السلوفينية' },
    { code: 'so', name: 'الصومالية' }, { code: 'es', name: 'الإسبانية' }, { code: 'su', name: 'السوندانية' },
    { code: 'sw', name: 'السواحيلية' }, { code: 'sv', name: 'السويدية' }, { code: 'tg', name: 'الطاجيكية' },
    { code: 'ta', name: 'التاميلية' }, { code: 'tt', name: 'التتارية' }, { code: 'te', name: 'التيلجو' },
    { code: 'th', name: 'التايلاندية' }, { code: 'tr', name: 'التركية' }, { code: 'tk', name: 'التركمانية' },
    { code: 'uk', name: 'الأوكرانية' }, { code: 'ur', name: 'الأردية' }, { code: 'ug', name: 'الأويغورية' },
    { code: 'uz', name: 'الأوزبكية' }, { code: 'vi', name: 'الفيتنامية' }, { code: 'cy', name: 'الويلزية' },
    { code: 'xh', name: 'الخوسا' }, { code: 'yi', name: 'اليديشية' }, { code: 'yo', name: 'اليوربا' },
    { code: 'zu', name: 'الزولو' }
];
function populateLanguageDropdown(selectElement, includeAuto) {
    const priorityCode = 'ar';
    const priorityLang = LANGUAGES.find(lang => lang.code === priorityCode);
    const otherLangs = LANGUAGES.filter(lang => lang.code !== priorityCode).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    let finalLangs = [priorityLang, ...otherLangs];
    if (includeAuto) finalLangs.unshift({ code: 'auto', name: 'كشف تلقائي' });
    finalLangs.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.code; option.textContent = lang.name;
        selectElement.appendChild(option);
    });
}