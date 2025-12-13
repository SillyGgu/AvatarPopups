import {
    eventSource,
    event_types,
    saveSettingsDebounced
} from '../../../../script.js';

import { 
    getContext,
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js'; 

import {
    characters, 
    this_chid,
    getThumbnailUrl
} from '../../../../script.js';

import {
    user_avatar
} from '../../../personas.js';

const extensionName = 'AvatarPopups';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const DEFAULT_AVATAR_PATH = '/img/five.png'; 


let currentEditingStickerPopupId = null; 

let stickerPanelPos = { top: -1, left: -1 }; 
let currentEditingAvatarType = null; 
let avatarPanelPos = { top: -1, left: -1 }; 
let isAvatarDragging = false; 

const DEFAULT_SETTINGS = {
    enabled: true,
    
    charEnabled: true,
    personaEnabled: true,

    ignoreClick: false, 
    autoPosAdjust: false, 
    isFloating: false, 
    
    
    ignoreCharClick: false,
    ignoreStickerClick: false,
    
    
    initialViewport: { width: window.innerWidth, height: window.innerHeight },

    charPos: { top: 20, left: 20 },
    personaPos: { top: 20, left: 800 },
    
    charConfig: { 
        width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } 
    },
    personaConfig: { 
        width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } 
    },
    
    stickerCounter: 0,
    savedStickers: [], 
    
    stickerFolders: ['전체', '기본'],
    
    activeStickers: [],
    
    linkedPresets: {}, 
    
    presets: {
        '기본 설정': { 
            charPos: { top: 20, left: 20 },
            personaPos: { top: 20, left: 800 },
            charConfig: { width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } }, 
            personaConfig: { width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } }, 
            activeStickers: []
        }
    }
};

let settings = extension_settings[extensionName];
let currentSelectedFolder = '전체'; 
let isStickerMovingMode = false; 
let selectedStickersForMove = new Set();
if (!settings || Object.keys(settings).length === 0) {
    settings = Object.assign({}, DEFAULT_SETTINGS);
    extension_settings[extensionName] = settings;
    saveSettingsDebounced();
} else {
    
    settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    settings.charConfig = Object.assign({}, DEFAULT_SETTINGS.charConfig, settings.charConfig);
    settings.personaConfig = Object.assign({}, DEFAULT_SETTINGS.personaConfig, settings.personaConfig);
    settings.presets = Object.assign({}, DEFAULT_SETTINGS.presets, settings.presets);
    settings.charConfig.imageAdjust = Object.assign({}, DEFAULT_SETTINGS.charConfig.imageAdjust, settings.charConfig.imageAdjust);
    settings.personaConfig.imageAdjust = Object.assign({}, DEFAULT_SETTINGS.personaConfig.imageAdjust, settings.personaConfig.imageAdjust);
    
    
    if (Array.isArray(settings.activeStickers)) {
        settings.activeStickers.forEach(sticker => {
            if (sticker.isFlipped === undefined) {
                sticker.isFlipped = false;
            }
            if (sticker.zIndex === undefined) {
                sticker.zIndex = 1000; 
            }
        });
    }

    extension_settings[extensionName] = settings;
}



function adjustPosBasedOnViewport() {
    if (!settings.autoPosAdjust) return; 

    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const initialWidth = settings.initialViewport.width;
    const initialHeight = settings.initialViewport.height;

    
    if (initialWidth === 0 || initialHeight === 0) return;

    
    const newCharLeft = settings.charPos.left * (currentWidth / initialWidth);
    const newCharTop = settings.charPos.top * (currentHeight / initialHeight);
    
    $('#char-avatar-popup').css({
        left: `${newCharLeft}px`,
        top: `${newCharTop}px`
    });
    
    
    const newPersonaLeft = settings.personaPos.left * (currentWidth / initialWidth);
    const newPersonaTop = settings.personaPos.top * (currentHeight / initialHeight);

    $('#persona-avatar-popup').css({
        left: `${newPersonaLeft}px`,
        top: `${newPersonaTop}px`
    });
    
    
    

    
    settings.activeStickers.forEach(activeSticker => {
        const $stickerPopup = $(`#${activeSticker.popupId}`);
        if ($stickerPopup.length) {
            
            const newStickerLeft = activeSticker.left * (currentWidth / initialWidth);
            const newStickerTop = activeSticker.top * (currentHeight / initialHeight);

            $stickerPopup.css({
                left: `${newStickerLeft}px`,
                top: `${newStickerTop}px`
            });
        }
    });
}




let resizeTimer;
const resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        adjustPosBasedOnViewport();
    }, 100); 
};


function startAutoPosAdjustment() {
    if (!settings.autoPosAdjust) return;
    
    
    settings.initialViewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    
    
    $(window).on('resize.AvatarPopups', resizeHandler);
    
    
    adjustPosBasedOnViewport();
    
    saveSettingsDebounced(); 
}


function stopAutoPosAdjustment() {
    $(window).off('resize.AvatarPopups');
}


function toggleFloating(isEnabled) {
    const $charPopup = $('#char-avatar-popup');
    const $personaPopup = $('#persona-avatar-popup');

    if (isEnabled) {
        $charPopup.addClass('floating-char');
        $personaPopup.addClass('floating-persona');
    } else {
        $charPopup.removeClass('floating-char');
        $personaPopup.removeClass('floating-persona');
    }
}

function applyConfigToPopup(type) {
    const $popup = $(`#${type}-avatar-popup`);
    const $img = $popup.find('img');
    const config = settings[`${type}Config`];
    
    if (!$popup.length) return;

    let rotation = parseInt(config.rotation) || 0;

    const imgConfig = config.imageAdjust || { x: 0, y: 0, zoom: 1, rotation: 0 };
    const imgZoom = imgConfig.zoom || 1;
    const imgInnerRotation = imgConfig.rotation || 0;
    const moveX = imgConfig.x ?? 0;
    const moveY = imgConfig.y ?? 0;
    
    let imgTransformString = `translate(${moveX}px, ${moveY}px) scale(${imgZoom}) rotate(${imgInnerRotation}deg)`;

    $img.css('transform', imgTransformString); 
    
    $img.css('object-position', `50% 50%`);
    $img.css('margin-left', '0px'); 
    $img.css('margin-top', '0px'); 

    $popup.css({
        width: `${config.width}px`,
        height: `${config.height}px`,
        transform: `rotate(${rotation}deg)`,
        '--avatar-rotation': `${rotation}deg` 
    });

    $popup.removeClass('square diamond circle arch').addClass(config.shape || 'square');
}


function applyPosToPopup(type) {
    const $popup = $(`#${type}-avatar-popup`);
    const pos = settings[`${type}Pos`];
    const config = settings[`${type}Config`]; 
    
    if (!$popup.length) return;

    
    if (!settings.autoPosAdjust && pos && pos.left !== 'auto') {
        $popup.css({
            top: pos.top + 'px',
            left: pos.left + 'px',
        });
    } else if (settings.autoPosAdjust) {
        
        
        adjustPosBasedOnViewport();
    }


    
    
    if ($popup.data('ui-draggable')) {
        $popup.draggable('destroy');
    }
    
    const isChar = (type === 'char');
    const posKey = isChar ? 'charPos' : 'personaPos';
    
    const dragCursorX = config.width / 2;
    const dragCursorY = config.height / 2;
    
    $popup.draggable({
        cursorAt: { left: dragCursorX, top: dragCursorY }, 
        containment: false,
        scroll: false,
        
        start: function() {
            isAvatarDragging = true; 
            
            hideAvatarConfigPanel();
        },
        stop: function(event, ui) {
            
            setTimeout(() => { isAvatarDragging = false; }, 0); 
            settings[posKey] = {
                top: ui.position.top,
                left: ui.position.left
            };
            
            
            settings.initialViewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            
            saveSettingsDebounced();
        }
    });
}



function renderActiveStickers() {
    
    $('.sticker-popup').remove();
    hideStickerConfigPanel();

    settings.activeStickers.forEach(activeSticker => {
        const savedSticker = settings.savedStickers.find(s => s.id === activeSticker.stickerId);
        if (savedSticker) {
            const $popup = $(`
                <div id="${activeSticker.popupId}" class="sticker-popup" data-sticker-id="${savedSticker.id}">
                    <img src="${savedSticker.link}" alt="${savedSticker.name} Sticker">
                    <div class="sticker-flip-btn" title="좌우 반전">&#x21C6;</div>
                    <div class="sticker-delete-btn" title="캔버스에서 제거 (클릭)">
                        &times;
                    </div>
                </div>
            `);

            $('body').append($popup);
            
            
            $popup.css({
                top: activeSticker.top + 'px',
                left: activeSticker.left + 'px',
                transform: `rotate(${activeSticker.rotation || 0}deg)`,
                width: `${activeSticker.width || 100}px`, 
                height: `${activeSticker.height || 100}px`, 
                'z-index': activeSticker.zIndex || 1000 
            });
            
            
            const flipTransform = activeSticker.isFlipped ? 'scaleX(-1)' : 'none';
            $popup.find('img').css('transform', flipTransform);
            
            
            $popup.on('click', onStickerPopupClick);
            
            
            $popup.find('.sticker-flip-btn').on('click', function(e) {
                e.stopPropagation(); 
                const popupId = $(this).parent().attr('id');
                toggleStickerFlip(popupId);
            });
            
            
            $popup.find('.sticker-delete-btn').on('click', function(e) {
                e.stopPropagation(); 
                const popupId = $(this).parent().attr('id');
                const stickerName = savedSticker.name; 
                
                if (confirm(`스티커 [${stickerName}]을(를) 캔버스에서 제거하시겠습니까?`)) {
                    removeStickerFromCanvas(popupId);
                }
            });

            
            $popup.draggable({
                containment: false, 
                scroll: false,
                start: function() {
                    
                    hideStickerConfigPanel(); 
                },
                stop: function(event, ui) {
                    const popupId = $(this).attr('id');
                    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
                    if (activeStickerIndex > -1) {
                        settings.activeStickers[activeStickerIndex].top = ui.position.top;
                        settings.activeStickers[activeStickerIndex].left = ui.position.left;
                        
                        
                        if (settings.autoPosAdjust) {
                            settings.initialViewport = {
                                width: window.innerWidth,
                                height: window.innerHeight
                            };
                        }
                        
                        saveSettingsDebounced();
                    }
                }
            });
            
            
            $popup.on('contextmenu', function(e) {
                 e.preventDefault();
                 if(confirm(`스티커 [${savedSticker.name}]을(를) 캔버스에서 제거하시겠습니까?`)) {
                    removeStickerFromCanvas(activeSticker.popupId);
                 }
            });
        }
    });
    
    
    toggleClickIgnore(settings.ignoreClick);
    togglePopups(settings.enabled);
}


function toggleStickerFlip(popupId) {
    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
    if (activeStickerIndex === -1) return;
    
    
    const newState = !settings.activeStickers[activeStickerIndex].isFlipped;
    settings.activeStickers[activeStickerIndex].isFlipped = newState;
    
    
    const $img = $(`#${popupId}`).find('img');
    const transform = newState ? 'scaleX(-1)' : 'none';
    
    $img.css('transform', transform);
    
    saveSettingsDebounced();
}


function removeStickerFromCanvas(popupId) {
    settings.activeStickers = settings.activeStickers.filter(s => s.popupId !== popupId);
    $(`#${popupId}`).remove();
    hideStickerConfigPanel(); 
    saveSettingsDebounced();
}


function renderStickerList(searchQuery = '') {
    const $container = $('#sticker-list-container-settings');
    $container.empty();
    
    // 이동 모드일 경우 컨테이너에 클래스 추가
    if (isStickerMovingMode) {
        $container.addClass('sticker-list-moving-mode');
    } else {
        $container.removeClass('sticker-list-moving-mode');
    }

    const query = searchQuery.trim().toLowerCase();
    
    // 필터링
    const filteredStickers = settings.savedStickers.filter(sticker => {
        const matchQuery = !query || sticker.name.toLowerCase().includes(query);
        const matchFolder = (currentSelectedFolder === '전체') || (sticker.folder === currentSelectedFolder);
        return matchQuery && matchFolder;
    });
    
    $('#sticker-count-display').text(filteredStickers.length);

    if (filteredStickers.length === 0) {
        let msg = '저장된 스티커가 없습니다.';
        if (query) msg = '검색된 스티커가 없습니다.';
        else if (currentSelectedFolder !== '전체') msg = `'${currentSelectedFolder}' 폴더에 스티커가 없습니다.`;
        
        $container.append(`<div id="sticker-list-placeholder" style="font-size: 0.8rem; color: #999; display: flex; align-items: center;">${msg}</div>`);
        return;
    }

    filteredStickers.forEach(sticker => { 
        // [수정] 현재 선택된 스티커라면 클래스 추가
        const isSelected = selectedStickersForMove.has(sticker.id);
        const selectedClass = isSelected ? 'selected' : '';

        const itemHtml = `
            <div class="sticker-item ${selectedClass}" data-id="${sticker.id}" title="${isStickerMovingMode ? '클릭하여 선택/해제' : '더블 클릭: 목록에서 영구 삭제'}">
                <div class="sticker-item-content">
                    <div class="sticker-name-area" data-id="${sticker.id}" title="${isStickerMovingMode ? '클릭하여 선택' : '단일 클릭: 이름 및 링크 수정'}"></div>
                    <div class="sticker-image-area"></div>
                    <img src="${sticker.link}" alt="${sticker.name} Preview" class="sticker-list-item-preview">
                    <div style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px;">${sticker.name}</div>
                </div>
                <div class="sticker-item-controls">
                    <button class="add-sticker-to-canvas" data-id="${sticker.id}" title="캔버스에 추가">+</button>
                    <button class="remove-sticker-from-canvas-btn" data-id="${sticker.id}" title="캔버스에서 1개 제거">-</button>
                </div>
            </div>
        `;
        $container.append(itemHtml);
    });

    if (!isStickerMovingMode) {
        $container.find('.add-sticker-to-canvas').on('click', onAddStickerToCanvas);
        $container.find('.remove-sticker-from-canvas-btn').on('click', onRemoveActiveStickerInstance); 
        $container.find('.sticker-name-area').on('click', onStickerItemClickToEdit); 
        $container.find('.sticker-item-content').on('dblclick', onDeleteStickerFromList); 
    } else {
        // 이동 모드일 때는 클릭 시 다중 선택 로직 실행
        $container.find('.sticker-item').on('click', onStickerMoveClick);
    }
}




function loadSettingsUI() {
    $('#avatar_popups_enable_toggle').prop('checked', settings.enabled);
    $('#avatar_popups_ignore_click_toggle').prop('checked', settings.ignoreClick).on('change', onIgnoreClickToggle);
    
    $('#avatar_popups_ignore_char_click_toggle')
        .prop('checked', settings.ignoreCharClick)
        .prop('disabled', settings.ignoreClick)
        .on('change', onIgnoreCharClickToggle);

    $('#avatar_popups_ignore_sticker_click_toggle')
        .prop('checked', settings.ignoreStickerClick)
        .prop('disabled', settings.ignoreClick)
        .on('change', onIgnoreStickerClickToggle);
    
    $('#avatar_popups_auto_adjust_toggle').prop('checked', settings.autoPosAdjust).on('change', onAutoPosAdjustToggle);
    $('#avatar_popups_floating_toggle').prop('checked', settings.isFloating).on('change', onFloatToggle);
    
    $('#char-enabled-toggle').prop('checked', settings.charEnabled !== false).on('change', onCharEnableToggle);
    $('#persona-enabled-toggle').prop('checked', settings.personaEnabled !== false).on('change', onPersonaEnableToggle);

    if (settings.autoPosAdjust) {
        startAutoPosAdjustment();
    } else {
        stopAutoPosAdjustment();
    }
    
    
    ['char', 'persona'].forEach(type => {
        const config = settings[`${type}Config`];
        
        $(`#${type}-width-input`).val(config.width);
        $(`#${type}-height-input`).val(config.height);
        $(`#${type}-rotation-input`).val(config.rotation);
        $(`#${type}-image-override-input`).val(config.imageOverride);
        $(`#${type}-shape-select`).val(config.shape); 
        
        applyConfigToPopup(type);
        applyPosToPopup(type);
    });
    
    // [추가됨] 설정 로드 시 기존 스티커에 폴더 정보가 없다면 '기본'으로 할당 & 폴더 목록 초기화
    if (!settings.stickerFolders) {
        settings.stickerFolders = ['전체', '기본'];
    }
    settings.savedStickers.forEach(s => {
        if (!s.folder) s.folder = '기본';
    });

    renderStickerFolders(); // 폴더 탭 렌더링
    renderStickerList();    // 스티커 목록 렌더링
    renderActiveStickers(); 

    
    renderPresetList();
    updatePresetButtons();
    
    
    toggleClickIgnore(settings.ignoreClick);
    toggleFloating(settings.isFloating);
}


function onStickerItemClickToEdit(e) {
    
    
    
    if ($(e.target).closest('.sticker-item-controls').length) {
        return; 
    }
    
    const $item = $(this).closest('.sticker-item'); 
    const stickerId = parseInt($item.data('id'));
    const savedSticker = settings.savedStickers.find(s => s.id === stickerId);
    
    if (!savedSticker) return;
    
    const originalName = savedSticker.name;
    const originalLink = savedSticker.link;
    
    
    const newCombinedValue = prompt(
        `스티커 [${originalName}] 의 이름 및 링크를 수정합니다.\n\n` +
        `[현재 이름]: ${originalName}\n` + 
        `[현재 이미지 링크 (복붙 가능)]: ${originalLink}\n\n` +
        
        `1. 이름만 수정: 새 이름을 입력하세요.\n` + 
        `2. 이름/링크 모두 수정: "새이름|새링크" 형식으로 입력하세요.\n` +
        `*새 링크는 현재 링크를 복사/수정하거나, 새 링크를 붙여넣으세요.*\n\n` +
        
        `[취소]를 누르면 수정이 취소됩니다.`, 
        originalName
    );

    if (newCombinedValue === null) {
        
        return;
    }
    
    const input = newCombinedValue.trim();
    
    
    if (input === originalName || input === '') {
        return;
    }
    
    const parts = input.split('|');
    
    let finalName = originalName;
    let finalLink = originalLink;

    if (parts.length > 1) {
        
        const potentialName = parts[0].trim();
        const potentialLink = parts[1].trim();
        
        if (potentialName !== '') {
            finalName = potentialName;
        }
        
        
        if (potentialLink.startsWith('http')) { 
            finalLink = potentialLink;
        }
    } else {
        
        if (input !== originalName) {
             finalName = input;
        }
    }

    if (finalName === originalName && finalLink === originalLink) {
        
        return;
    }
    
    if (finalName === '') {
        alert('이름은 비워둘 수 없습니다. 수정이 취소됩니다.');
        return;
    }

    
    savedSticker.name = finalName;
    savedSticker.link = finalLink;
    
    
    renderStickerList($('#sticker-search-input').val()); 
    
    
    $(`.sticker-popup[data-sticker-id="${stickerId}"]`).find('img').attr('src', finalLink);
    
    
    saveSettingsDebounced();
    
    alert(`스티커 [${originalName}]이(가) 이름: [${finalName}], 링크: [${finalLink}] (으)로 수정되었습니다.`);
}


function toggleClickIgnore(isEnabled) {
    
    if (isEnabled) {
        
        const $popups = $('#char-avatar-popup, #persona-avatar-popup, .sticker-popup');
        $popups.addClass('ignore-click');
    } else {
        
        
        
        const $avatarPopups = $('#char-avatar-popup, #persona-avatar-popup');
        if (settings.ignoreCharClick) {
            $avatarPopups.addClass('ignore-click');
        } else {
            $avatarPopups.removeClass('ignore-click');
        }

        
        const $stickerPopups = $('.sticker-popup');
        if (settings.ignoreStickerClick) {
            $stickerPopups.addClass('ignore-click');
        } else {
            $stickerPopups.removeClass('ignore-click');
        }
    }
}


function onEnableToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.enabled = value;
    togglePopups(value);
    saveSettingsDebounced();
}

function onIgnoreClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreClick = value;
    toggleClickIgnore(value);
    saveSettingsDebounced();
    
    $('#avatar_popups_ignore_char_click_toggle').prop('disabled', value);
    $('#avatar_popups_ignore_sticker_click_toggle').prop('disabled', value);
}


function onIgnoreCharClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreCharClick = value;
    
    if (!settings.ignoreClick) { 
        toggleClickIgnore(false); 
    }
    saveSettingsDebounced();
}


function onIgnoreStickerClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreStickerClick = value;
    
    if (!settings.ignoreClick) { 
        toggleClickIgnore(false); 
    }
    saveSettingsDebounced();
}


function onAutoPosAdjustToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.autoPosAdjust = value;
    
    if (value) {
        startAutoPosAdjustment();
    } else {
        stopAutoPosAdjustment();
        
        applyPosToPopup('char'); 
        applyPosToPopup('persona'); 
    }
    
    saveSettingsDebounced();
}
function onFloatToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.isFloating = value;
    toggleFloating(value); 
    saveSettingsDebounced();
}

function onCharEnableToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.charEnabled = value;
    togglePopups(settings.enabled); // 상태 갱신
    saveSettingsDebounced();
}

function onPersonaEnableToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.personaEnabled = value;
    togglePopups(settings.enabled); // 상태 갱신
    saveSettingsDebounced();
}

function onAvatarConfigInput() {
    const $input = $(this);
    const type = $input.data('type'); 
    const key = $input.data('key');   
    
    let value = $input.val();
    
    if (key === 'width' || key === 'height') {
        value = parseInt(value) || 0;
        if (value < 10) value = 10; 
    } else if (key === 'rotation') {
        value = parseInt(value) || 0;
    } else {
        
        value = value.trim();
    }
    
    settings[`${type}Config`][key] = value;
    
    
    applyConfigToPopup(type);
    
    
    if (key === 'imageOverride' && !value) {
        updateAvatars();
    }

    
    applyPosToPopup(type);
    
    saveSettingsDebounced();
}


function onTabClick() {
    const $tab = $(this);
    const target = $tab.data('target');

    
    $('#avatar-persona-tab-container').find('.tab').removeClass('active').css({
        background: '#f1f1f1',
        borderColor: 'transparent'
    });
    $tab.addClass('active').css({
        background: 'var(--white-color, #FFFFFF)',
        borderColor: 'var(--accent-color, #EC407A)'
    });

    
    $('.avatar-controls-container').hide().removeClass('active');
    $(`#${target}`).show().addClass('active');
}
function renderStickerFolders() {
    const $container = $('#sticker-folder-container');
    // '+' 버튼(마지막 요소)을 제외하고 탭 제거
    $container.find('.sticker-folder-tab').remove();

    settings.stickerFolders.forEach(folderName => {
        const isActive = (folderName === currentSelectedFolder) ? 'active' : '';
        // '전체'와 '기본'은 삭제 불가, 나머지는 우클릭 등으로 삭제/이름변경 고려 가능(여기선 단순화)
        const tabHtml = `<div class="sticker-folder-tab ${isActive}" data-folder="${folderName}">${folderName}</div>`;
        
        // + 버튼 앞에 삽입
        $('#add-sticker-folder-btn').before(tabHtml);
    });

    // 이벤트 연결
    $('.sticker-folder-tab').off('click').on('click', function() {
        const folder = $(this).data('folder');
        currentSelectedFolder = folder;
        renderStickerFolders(); // 탭 활성화 상태 갱신
        renderStickerList($('#sticker-search-input').val()); // 리스트 갱신
    });

    // 폴더 탭 우클릭 시 삭제/이름변경 (전체, 기본 제외)
    $('.sticker-folder-tab').on('contextmenu', function(e) {
        e.preventDefault();
        const folder = $(this).data('folder');
        if (folder === '전체' || folder === '기본') return;

        if (confirm(`폴더 [${folder}]를 삭제하시겠습니까?\n(내부의 스티커는 '기본' 폴더로 이동됩니다)`)) {
            // 내부 스티커 이동
            settings.savedStickers.forEach(s => {
                if (s.folder === folder) s.folder = '기본';
            });
            // 폴더 삭제
            settings.stickerFolders = settings.stickerFolders.filter(f => f !== folder);
            
            // 현재 보고 있던 폴더가 삭제되면 '전체'로 이동
            if (currentSelectedFolder === folder) currentSelectedFolder = '전체';
            
            saveSettingsDebounced();
            renderStickerFolders();
            renderStickerList($('#sticker-search-input').val());
        }
    });
}

function onAddFolder() {
    const newName = prompt("새 폴더 이름을 입력하세요:");
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    
    if (settings.stickerFolders.includes(trimmed)) {
        alert("이미 존재하는 폴더 이름입니다.");
        return;
    }

    settings.stickerFolders.push(trimmed);
    saveSettingsDebounced();
    
    // 새 폴더로 바로 이동
    currentSelectedFolder = trimmed;
    renderStickerFolders();
    renderStickerList();
}

function onToggleStickerEditMode() {
    // [수정] 이미 이동 모드이고, 선택된 스티커가 있다면 -> 모달 띄우기 (모드 종료 X)
    if (isStickerMovingMode && selectedStickersForMove.size > 0) {
        showFolderSelectionModal();
        return;
    }

    // 그 외(일반 토글 혹은 선택 없이 완료 누름)
    isStickerMovingMode = !isStickerMovingMode;
    const $btn = $('#toggle-sticker-edit-mode-btn');
    
    if (isStickerMovingMode) {
        selectedStickersForMove.clear(); // 모드 진입 시 선택 초기화
        $btn.addClass('active');
        $btn.html('💾 완료'); 
        $('#sticker-move-instruction').text('(스티커를 클릭해 선택 후, 완료 버튼을 누르세요)').show();
        $('#sticker-search-input').prop('disabled', true);
    } else {
        selectedStickersForMove.clear(); // 모드 종료 시 선택 초기화
        $btn.removeClass('active');
        $btn.html('✏️');
        $('#sticker-move-instruction').hide();
        $('#sticker-search-input').prop('disabled', false);
    }

    renderStickerList($('#sticker-search-input').val());
}

function onStickerMoveClick(e) {
    if (!isStickerMovingMode) return;
    e.stopPropagation();

    const $item = $(this);
    const stickerId = parseInt($item.data('id'));
    
    // 선택 토글 로직
    if (selectedStickersForMove.has(stickerId)) {
        selectedStickersForMove.delete(stickerId);
        $item.removeClass('selected');
    } else {
        selectedStickersForMove.add(stickerId);
        $item.addClass('selected');
    }

    // 안내 메시지 업데이트
    const count = selectedStickersForMove.size;
    if (count > 0) {
        $('#sticker-move-instruction').text(`(${count}개 선택됨 - 완료 버튼을 눌러 이동)`);
        $('#toggle-sticker-edit-mode-btn').html(`💾 이동 (${count})`);
    } else {
        $('#sticker-move-instruction').text('(스티커를 클릭해 선택 후, 완료 버튼을 누르세요)');
        $('#toggle-sticker-edit-mode-btn').html('💾 완료');
    }
}
function showFolderSelectionModal() {
    const $modalOverlay = $('#sticker-move-modal-overlay');
    const $listArea = $('#sticker-move-folder-list-area');
    
    // 선택된 개수 메시지
    $('#sticker-move-count-msg').text(`총 ${selectedStickersForMove.size}개의 스티커를 어디로 옮길까요?`);
    
    // 폴더 목록 버튼 생성
    $listArea.empty();
    
    // '전체'는 이동 대상이 아니므로 제외
    const targetFolders = settings.stickerFolders.filter(f => f !== '전체');

    targetFolders.forEach(folderName => {
        const btn = $(`<button class="sticker-move-folder-btn">📁 ${folderName}</button>`);
        btn.on('click', () => executeBatchMove(folderName));
        $listArea.append(btn);
    });

    $modalOverlay.css('display', 'flex'); // 모달 보이기
    
    // 취소 버튼 이벤트 연결 (한번만)
    $('#close-sticker-move-modal-btn').off('click').on('click', closeFolderSelectionModal);
}

function closeFolderSelectionModal() {
    $('#sticker-move-modal-overlay').hide();
}

function executeBatchMove(targetFolder) {
    if (selectedStickersForMove.size === 0) return;

    let moveCount = 0;
    
    settings.savedStickers.forEach(sticker => {
        if (selectedStickersForMove.has(sticker.id)) {
            // 이미 같은 폴더면 건너뛰기
            if (sticker.folder !== targetFolder) {
                sticker.folder = targetFolder;
                moveCount++;
            }
        }
    });

    saveSettingsDebounced();
    
    alert(`${moveCount}개의 스티커를 [${targetFolder}] 폴더로 이동했습니다.`);
    
    // 정리 작업
    selectedStickersForMove.clear();
    closeFolderSelectionModal();
    
    // 편집 모드 종료
    onToggleStickerEditMode(); 
    
    // UI 갱신 (현재 폴더가 바뀌었을 수 있으므로 목록 다시 그리기)
    // 만약 이동한 폴더로 바로 보여주고 싶다면 currentSelectedFolder = targetFolder; 추가 가능
    // 여기선 기존 뷰 유지
    renderStickerFolders(); 
    renderStickerList($('#sticker-search-input').val());
}
function onSaveNewSticker() {
    const name = $('#sticker-name-input').val().trim();
    const link = $('#sticker-image-link-input').val().trim();

    if (!name || !link) {
        alert('스티커 이름과 이미지 링크를 모두 입력해주세요.');
        return;
    }
    
    // [수정됨] 현재 선택된 폴더가 '전체'라면 '기본'에, 아니면 해당 폴더에 저장
    const targetFolder = (currentSelectedFolder === '전체') ? '기본' : currentSelectedFolder;

    settings.stickerCounter++;
    settings.savedStickers.push({
        id: settings.stickerCounter,
        name: name,
        link: link,
        folder: targetFolder // 폴더 정보 저장
    });

    
    $('#sticker-name-input').val('');
    $('#sticker-image-link-input').val('');
    $('#add-sticker-input-popup').hide(); 
    $('#toggle-add-sticker-input-btn').text('새 스티커 팝업 저장 및 추가');
    
    renderStickerList($('#sticker-search-input').val()); 
    saveSettingsDebounced();

    alert(`[${targetFolder}] 폴더에 저장되었습니다.`);
}


function onAddStickerToCanvas() {
    const stickerId = parseInt($(this).data('id'));
    const uniquePopupId = `sticker-${stickerId}-${Date.now()}`;
    
    
    settings.activeStickers.push({
        stickerId: stickerId,
        top: 100 + Math.random() * 200, 
        left: 100 + Math.random() * 200,
        width: 100, 
        height: 100, 
        rotation: 0,
        isFlipped: false, 
        zIndex: 1000, 
        popupId: uniquePopupId 
    });
    
    renderActiveStickers();
    if (settings.autoPosAdjust) {
        adjustPosBasedOnViewport(); 
    }
    
    saveSettingsDebounced();
}


function onRemoveActiveStickerInstance() {
    const stickerId = parseInt($(this).data('id'));
    
    
    const activeIndex = settings.activeStickers.slice().reverse().findIndex(s => s.stickerId === stickerId);
    
    if (activeIndex > -1) {
        
        const realIndex = settings.activeStickers.length - 1 - activeIndex;
        
        const popupIdToRemove = settings.activeStickers[realIndex].popupId;
        
        
        settings.activeStickers.splice(realIndex, 1);
        
        
        $(`#${popupIdToRemove}`).remove();
        
        hideStickerConfigPanel(); 
        saveSettingsDebounced();
    } else {
        alert('캔버스에 해당 스티커가 활성화되어 있지 않습니다.');
    }
}


function onDeleteStickerFromList(e) {
    
    if ($(e.target).closest('.sticker-item-controls').length) {
        e.stopPropagation(); 
        return; 
    }
    
    const stickerId = parseInt($(this).closest('.sticker-item').data('id'));
    const stickerIndex = settings.savedStickers.findIndex(s => s.id === stickerId);
    
    if (stickerIndex > -1) {
        const stickerName = settings.savedStickers[stickerIndex].name;
        
        if (confirm(`스티커 목록에서 [${stickerName}]을(를) 영구 삭제하고, 캔버스에 있는 모든 인스턴스를 제거하시겠습니까?`)) {
            
            
            settings.savedStickers.splice(stickerIndex, 1);
            
            
            settings.activeStickers = settings.activeStickers.filter(s => {
                if (s.stickerId === stickerId) {
                    $(`#${s.popupId}`).remove();
                    return false;
                }
                return true;
            });
            
            
            renderStickerList($('#sticker-search-input').val());
            
            hideStickerConfigPanel();
            saveSettingsDebounced();
        }
    }
}







function onStickerPopupClick(event) {
    event.stopPropagation(); 
    const $popup = $(this);
    const popupId = $popup.attr('id');
    const activeSticker = settings.activeStickers.find(s => s.popupId === popupId);
    
    if (!activeSticker) return;

    
    currentEditingStickerPopupId = popupId;
    
    
    showStickerConfigPanel(activeSticker);
}



function updateStickerConfig(popupId, key, value) {
    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
    if (activeStickerIndex === -1) return;

    
    const $popup = $(`#${popupId}`);
    if ($popup.length) {
        if (key === 'rotation') {
            settings.activeStickers[activeStickerIndex].rotation = value;
            $popup.css('transform', `rotate(${value}deg)`);
        } else if (key === 'width') { 
            settings.activeStickers[activeStickerIndex].width = value;
            settings.activeStickers[activeStickerIndex].height = value;
            $popup.css({
                'width': `${value}px`,
                'height': `${value}px`
            });
        } else if (key === 'zIndex') { 
            settings.activeStickers[activeStickerIndex].zIndex = value;
            $popup.css('z-index', value);
        }
    }
    
    saveSettingsDebounced();
}


function createStickerConfigPanel() {
    if ($('#sticker-config-panel').length) return;

    const panelHtml = `
        <div id="sticker-config-panel" class="st-floating-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; cursor: move;">
                <h4 style="margin: 0; font-size: 1rem;">🖼️ 스티커 설정</h4>
                <button id="close-sticker-config-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; padding: 0;">&times;</button>
            </div>
            
            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">사이즈 (px) [W=H]</label>
                <input type="number" id="sticker-size-input" class="sticker-config-input" data-key="width" min="10" placeholder="100" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>
            
            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">회전각 (°)</label>
                <input type="number" id="sticker-rotation-input" class="sticker-config-input" data-key="rotation" placeholder="0" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>

            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">레이어 순서 (Z-index)</label>
                <input type="number" id="sticker-zindex-input" class="sticker-config-input" data-key="zIndex" placeholder="1000" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>
        </div>
    `;

    $('body').append(panelHtml);
    const $panel = $('#sticker-config-panel');
    
    
    $panel.draggable({
        handle: 'div:first-child', 
        containment: 'window', 
        scroll: false,
        stop: function(event, ui) {
            
            stickerPanelPos.top = ui.position.top;
            stickerPanelPos.left = ui.position.left;
        }
    });
    
    
    $('#close-sticker-config-btn').on('click', hideStickerConfigPanel);
    
    $('.sticker-config-input').on('input', function() {
        if (!currentEditingStickerPopupId) return;

        const $input = $(this);
        const key = $input.data('key');
        let value = parseInt($input.val());
        
        if (isNaN(value)) {
            
            value = (key === 'width' || key === 'height') ? 10 : 0;
        }

        
        if (key === 'width') { 
            value = Math.max(10, value);
        }
        
        updateStickerConfig(currentEditingStickerPopupId, key, value);
    });
}


function showStickerConfigPanel(activeSticker) {
    if (!$('#sticker-config-panel').length) {
        createStickerConfigPanel();
    }
    
    const $panel = $('#sticker-config-panel');

    
    $('#sticker-size-input').val(activeSticker.width);
    $('#sticker-rotation-input').val(activeSticker.rotation);
    
    $('#sticker-zindex-input').val(activeSticker.zIndex || 1000);
    
    
    if (stickerPanelPos.top === -1 || stickerPanelPos.left === -1) {
        
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        
        const panelWidth = $panel.outerWidth();
        const panelHeight = $panel.outerHeight();
        
        const centeredTop = (windowHeight / 2) - (panelHeight / 2);
        const centeredLeft = (windowWidth / 2) - (panelWidth / 2);
        
        $panel.css({
            top: centeredTop + 'px',
            left: centeredLeft + 'px'
        });
        
        
        stickerPanelPos.top = centeredTop;
        stickerPanelPos.left = centeredLeft;

    } else {
        
        $panel.css({
            top: stickerPanelPos.top + 'px',
            left: stickerPanelPos.left + 'px'
        });
    }

    
    $panel.show();
    
    
    $('.sticker-popup').removeClass('editing');
    $(`#${activeSticker.popupId}`).addClass('editing');
}


function hideStickerConfigPanel() {
    hideAvatarConfigPanel(); 
    $('#sticker-config-panel').hide();
    currentEditingStickerPopupId = null;
    $('.sticker-popup').removeClass('editing'); 
}


function onAvatarPopupClick(event) {
    event.stopPropagation(); 
    const $popup = $(event.currentTarget); 
    const popupId = $popup.attr('id');
    const type = (popupId === 'char-avatar-popup') ? 'char' : 'persona';
    
    if (!type) return;

    
    
    
    hideStickerConfigPanel(); 
    
    
    currentEditingAvatarType = type;
    
    
    showAvatarConfigPanel(type);
}






function createAvatarConfigPanel() {
    if ($('#avatar-config-panel').length) return;

    
    const panelHtml = `
        <div id="avatar-config-panel" class="st-floating-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; cursor: move;">
                <h4 style="margin: 0; font-size: 1rem;">🖼️ 이미지 조정</h4>
                <button id="close-avatar-config-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; padding: 0;">&times;</button>
            </div>
            
            <div class="control-group" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="dpad-container">
                    <button class="dpad-btn" id="dpad-up" data-axis="y" data-val="-1" title="위로 (Y-)">▲</button>
                    <button class="dpad-btn" id="dpad-left" data-axis="x" data-val="-1" title="왼쪽으로 (X-)">◄</button>
                    <div class="dpad-center"></div>
                    <button class="dpad-btn" id="dpad-right" data-axis="x" data-val="1" title="오른쪽으로 (X+)">►</button>
                    <button class="dpad-btn" id="dpad-down" data-axis="y" data-val="1" title="아래로 (Y+)">▼</button>
                </div>
                
                <div style="flex-grow: 1; margin-left: 10px;">
                    <label style="font-size: 0.8rem; margin-bottom: 5px; display: block;">D-Pad 이동량 (%)</label>
                    <select id="avatar-adjust-dpad-step" style="width: 100%; padding: 5px; border: 1px solid #d0d0d0; border-radius: 4px;">
                        <option value="1">1%</option>
                        <option value="5" selected>5%</option>
                        <option value="10">10%</option>
                    </select>
                </div>
            </div>

            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">확대/축소 (Zoom)</label>
                <div style="display: flex; align-items: center;">
                    <input type="range" id="avatar-adjust-zoom-slider" class="avatar-adjust-input" data-key="zoom" min="0.5" max="5" step="0.1" style="width: 70%; margin-right: 10px;">
                    <input type="number" id="avatar-adjust-zoom-input" class="avatar-adjust-input" data-key="zoom" min="0.5" max="5" step="0.1" style="width: 30%;">
                </div>
            </div>

            <div class="control-group" style="margin-top: 10px;">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">이미지 회전 (°)</label>
                <div style="display: flex; align-items: center;">
                    <input type="range" id="avatar-adjust-rotation-slider" class="avatar-adjust-input" data-key="rotation" min="-180" max="180" step="1" style="width: 70%; margin-right: 10px;">
                    <input type="number" id="avatar-adjust-rotation-input" class="avatar-adjust-input" data-key="rotation" min="-180" max="180" step="1" style="width: 30%;">
                </div>
            </div>
            
            <div class="control-group" style="margin-top: 15px; text-align: center;">
                <button id="avatar-adjust-reset-btn" style="width: 100%; padding: 8px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 5px; cursor: pointer; transition: background-color 0.1s ease;">조정값 초기화</button>
            </div>
        </div>
    `;

    $('body').append(panelHtml);
    const $panel = $('#avatar-config-panel');
    
    
    $panel.draggable({
        handle: 'div:first-child',
        containment: 'window', 
        scroll: false,
        stop: function(event, ui) {
            avatarPanelPos.top = ui.position.top;
            avatarPanelPos.left = ui.position.left;
        }
    });
    
    
    $('#close-avatar-config-btn').on('click', hideAvatarConfigPanel);
    

	
    
    $('.avatar-adjust-input').on('input', function() {
        if (!currentEditingAvatarType) return;
        
        const $input = $(this);
        const key = $input.data('key'); 
        let value = parseFloat($input.val());
        
        if (isNaN(value)) {
            value = (key === 'zoom') ? 1 : 0;
        }
        
        
        if ($input.is('[type="range"]')) {
            $(`#avatar-adjust-${key}-input`).val(value);
        } else {
            $(`#avatar-adjust-${key}-slider`).val(value);
        }
        
        
        settings[`${currentEditingAvatarType}Config`].imageAdjust[key] = value;
        
        applyConfigToPopup(currentEditingAvatarType);
        saveSettingsDebounced();
    });
    
    
    $('#avatar-adjust-reset-btn').on('click', function() {
        if (!currentEditingAvatarType) return;
        
        const defaultConfig = DEFAULT_SETTINGS.charConfig.imageAdjust; 
        settings[`${currentEditingAvatarType}Config`].imageAdjust = JSON.parse(JSON.stringify(defaultConfig));
        
        
        $('#avatar-adjust-zoom-slider, #avatar-adjust-zoom-input').val(defaultConfig.zoom);
        $('#avatar-adjust-rotation-slider, #avatar-adjust-rotation-input').val(defaultConfig.rotation);
        
        applyConfigToPopup(currentEditingAvatarType);
        saveSettingsDebounced();
    });

    
    $('#avatar-adjust-reset-btn').hover(
        function() { $(this).css('background-color', '#e0e0e0'); },
        function() { $(this).css('background-color', '#f0f0f0'); }
    );
	$('#avatar-config-panel').on('click', '.dpad-btn', function() {
		if (!currentEditingAvatarType) return;
		const $btn = $(this);
		const axis = $btn.data('axis'); // 'x' 또는 'y'
		const dir = parseInt($btn.data('val')); // -1 (상/좌) 또는 1 (하/우)
		
		// 이동량 설정값 가져오기 (기본값 5. 픽셀 조정을 위해 * 2)
		const step = (parseInt($('#avatar-adjust-dpad-step').val()) || 5) * 2; 
		
		// 현재 설정 가져오기
		let config = settings[`${currentEditingAvatarType}Config`];
		if (!config.imageAdjust) {
			config.imageAdjust = { x: 0, y: 0, zoom: 1, rotation: 0 };
		}
		
		let currentVal = config.imageAdjust[axis] || 0; // x 또는 y 값
		
        // X축 (좌우) 또는 Y축 (상하) 값만 변경합니다.
		if (axis === 'y' || axis === 'x') {
			currentVal += dir * step; 
		}
		
		// 값 저장 및 적용 (축에 해당하는 값만 변경합니다)
        // 이 로직은 imageAdjust.zoom 값을 건드리지 않습니다.
		settings[`${currentEditingAvatarType}Config`].imageAdjust[axis] = currentVal; 
		applyConfigToPopup(currentEditingAvatarType); 
		saveSettingsDebounced();
	});
}


function showAvatarConfigPanel(type) {
    if (!$('#avatar-config-panel').length) {
        createAvatarConfigPanel();
    }
    
    const $panel = $('#avatar-config-panel');
    const config = settings[`${type}Config`].imageAdjust;

    
    $('#avatar-adjust-zoom-slider, #avatar-adjust-zoom-input').val(config.zoom || 1);
    $('#avatar-adjust-rotation-slider, #avatar-adjust-rotation-input').val(config.rotation || 0);
    
    
    if (avatarPanelPos.top === -1 || avatarPanelPos.left === -1) {
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const panelWidth = $panel.outerWidth();
        const panelHeight = $panel.outerHeight();
        const centeredTop = Math.max(0, (windowHeight / 2) - (panelHeight / 2));
        const centeredLeft = Math.max(0, (windowWidth / 2) - (panelWidth / 2));
        
        $panel.css({ top: centeredTop + 'px', left: centeredLeft + 'px' });
        avatarPanelPos.top = centeredTop;
        avatarPanelPos.left = centeredLeft;
    } else {
        $panel.css({ top: avatarPanelPos.top + 'px', left: avatarPanelPos.left + 'px' });
    }

    
    $panel.show();
    
    
    $('.avatar-popup').removeClass('editing-avatar');
    $(`#${type}-avatar-popup`).addClass('editing-avatar');
}


function hideAvatarConfigPanel() {
    $('#avatar-config-panel').hide();
    currentEditingAvatarType = null;
    $('.avatar-popup').removeClass('editing-avatar'); 
}



function renderPresetList() {
    const $select = $('#preset-select-dropdown');
    const selectedPreset = $select.val();
    $select.empty();
    
    $select.append('<option value="" data-preset="none" disabled>저장된 프리셋을 선택하세요...</option>');

    Object.keys(settings.presets).forEach(name => {
        $select.append(`<option value="${name}">${name}</option>`);
    });
    
    if (selectedPreset && settings.presets[selectedPreset]) {
        $select.val(selectedPreset);
    } else {
        $select.val('');
    }
}

function onSavePreset() {
    const presetName = $('#preset-name-input').val().trim();
    if (!presetName) {
        alert('프리셋 이름을 입력해주세요.');
        return;
    }
    if (settings.presets[presetName] && !confirm(`프리셋 [${presetName}]이(가) 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return;
    }

    
    const currentPresetData = {
        charPos: JSON.parse(JSON.stringify(settings.charPos)),       
        personaPos: JSON.parse(JSON.stringify(settings.personaPos)), 
        charConfig: JSON.parse(JSON.stringify(settings.charConfig)),
        personaConfig: JSON.parse(JSON.stringify(settings.personaConfig)),
        activeStickers: JSON.parse(JSON.stringify(settings.activeStickers)),
    };

    settings.presets[presetName] = currentPresetData;
    
    alert(`프리셋 [${presetName}]이(가) 저장되었습니다.`);
    $('#preset-name-input').val('');
    renderPresetList();
    saveSettingsDebounced();
}

function applyPreset(presetName) {
    if (!presetName || !settings.presets[presetName]) return false;
    
    const preset = settings.presets[presetName];
    
    settings.charPos = JSON.parse(JSON.stringify(preset.charPos));
    settings.personaPos = JSON.parse(JSON.stringify(preset.personaPos));
    
    settings.charConfig = Object.assign({}, DEFAULT_SETTINGS.charConfig, preset.charConfig);
    settings.personaConfig = Object.assign({}, DEFAULT_SETTINGS.personaConfig, preset.personaConfig);
    
    if (preset.activeStickers) {
        settings.activeStickers = JSON.parse(JSON.stringify(preset.activeStickers));
    } else {
        settings.activeStickers = [];
    }
    
    // UI 및 화면 갱신
    loadSettingsUI(); 
    return true;
}

// [기존 수정] 버튼 클릭 시 프리셋 로드
function onLoadPreset() {
    const presetName = $('#preset-select-dropdown').val();
    
    if (applyPreset(presetName)) {
        alert(`프리셋 [${presetName}]을(를) 불러왔습니다.`);
        saveSettingsDebounced();
    }
}

// [신규 기능] 캐릭터 변경 시 연동된 프리셋 확인 및 자동 로드
function checkAndLoadCharacterPreset() {
    if (!settings.enabled || !this_chid || !characters[this_chid]) return;

    const currentCharacter = characters[this_chid];
    // 캐릭터 식별자로 avatar 파일명을 사용 (이름은 중복될 수 있으므로)
    const charId = currentCharacter.avatar; 
    
    // 연동된 프리셋이 있는지 확인
    if (settings.linkedPresets && settings.linkedPresets[charId]) {
        const targetPresetName = settings.linkedPresets[charId];
        
        // 해당 프리셋이 실제로 존재하는지 확인
        if (settings.presets[targetPresetName]) {
            console.log(`[AvatarPopups] Auto-loading preset '${targetPresetName}' for character '${currentCharacter.name}'`);
            applyPreset(targetPresetName);
            // 자동 로드 후에는 저장을 바로 하지 않아도 되지만, 
            // 현재 상태 유지를 위해 저장하고 싶다면 아래 주석 해제
            // saveSettingsDebounced();
        }
    }
}

function onDeletePreset() {
    const presetName = $('#preset-select-dropdown').val();
    if (!presetName || !settings.presets[presetName]) return;

    if (confirm(`프리셋 [${presetName}]을(를) 삭제하시겠습니까?`)) {
        delete settings.presets[presetName];
        renderPresetList();
        updatePresetButtons();
        alert(`프리셋 [${presetName}]이(가) 삭제되었습니다.`);
        saveSettingsDebounced();
    }
}
function onExportPreset() {
    const presetName = $('#preset-select-dropdown').val();
    if (!presetName || !settings.presets[presetName]) return;

    const includeLinks = $('#preset-include-links-toggle').is(':checked');
    const presetData = settings.presets[presetName];

    // 1. 프리셋에 사용된 스티커들의 정의(Definition)를 추출합니다.
    // 받는 사람에게는 해당 스티커 ID가 없을 수 있으므로, 이름과 링크 정보를 함께 포장해야 합니다.
    const usedStickerIds = new Set();
    if (presetData.activeStickers) {
        presetData.activeStickers.forEach(s => usedStickerIds.add(s.stickerId));
    }

    const stickerDefinitions = [];
    usedStickerIds.forEach(id => {
        const found = settings.savedStickers.find(s => s.id === id);
        if (found) {
            stickerDefinitions.push({
                originalId: id, // 매핑용 임시 ID
                name: found.name,
                // 링크 포함 옵션이 꺼져있으면 빈 문자열로 내보냄 (신상 보호)
                link: includeLinks ? found.link : "" 
            });
        }
    });

    // 2. 내보낼 최종 데이터 구조 생성
    const exportObject = {
        meta: {
            version: "1.0",
            exportedAt: Date.now(),
            includeLinks: includeLinks
        },
        name: presetName,
        presetSettings: presetData, // 위치, 크기 등
        stickers: stickerDefinitions // 스티커 정보 (이름, 링크)
    };

    // 3. JSON 파일로 다운로드 트리거
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `AvatarPopups_${presetName}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// -----------------------------------------------------------------
// 캐릭터별 프리셋 연동 UI 및 로직
// -----------------------------------------------------------------

function renderCharacterLinkUI() {
    // [수정됨] 현재 선택된 캐릭터 정보 가져오기 로직 강화
    if (typeof this_chid === 'undefined' || this_chid === undefined || !characters[this_chid]) {
        $('#char-link-info-area').html('<span style="color: #999;">캐릭터 정보를 찾을 수 없습니다.<br>(채팅방에 입장해 있나요?)</span>');
        $('#save-char-link-btn').prop('disabled', true);
        $('#remove-char-link-btn').prop('disabled', true);
        return;
    }

    const currentCharacter = characters[this_chid];
    const charId = currentCharacter.avatar;
    const charName = currentCharacter.name;
    const linkedPreset = settings.linkedPresets ? settings.linkedPresets[charId] : null;

    // UI 텍스트 업데이트
    let statusHtml = `<strong>현재 캐릭터:</strong> ${charName}<br>`;
    
    if (linkedPreset && settings.presets[linkedPreset]) {
        statusHtml += `<strong>연동된 프리셋:</strong> <span style="color: var(--accent-color);">${linkedPreset}</span>`;
        $('#remove-char-link-btn').prop('disabled', false);
        
        // 편의성: 이미 연동된게 있다면 드롭다운도 맞춰줍니다.
        const $dropdown = $('#preset-select-dropdown');
        if ($dropdown.val() !== linkedPreset) {
             $dropdown.val(linkedPreset);
             updatePresetButtons(); // 버튼 상태 갱신
        }
    } else {
        statusHtml += `<strong>연동 상태:</strong> <span style="color: #999;">없음 (프리셋 선택 후 '연동 저장' 클릭)</span>`;
        $('#remove-char-link-btn').prop('disabled', true);
    }

    $('#char-link-info-area').html(statusHtml);
    $('#save-char-link-btn').prop('disabled', false);
    
    // 전체 목록도 갱신 (리스트가 열려있을 수 있으므로)
    renderAllLinkedPresetsList();
}

// [신규 기능] 연동된 모든 캐릭터 목록 렌더링
function renderAllLinkedPresetsList() {
    const $container = $('#linked-char-list-container');
    $container.empty();

    if (!settings.linkedPresets || Object.keys(settings.linkedPresets).length === 0) {
        $container.append('<div style="padding: 10px; text-align: center; color: #999; font-size: 0.8rem;">연동된 캐릭터가 없습니다.</div>');
        return;
    }

    // 캐릭터 이름 매핑을 위해 characters 배열을 순회하여 맵 생성 (ID -> Name)
    // 캐릭터가 삭제되었을 수도 있으므로, avatar 파일명을 기준으로 매칭 시도
    const avatarToNameMap = {};
    if (Array.isArray(characters)) {
        characters.forEach(c => {
            if (c.avatar) avatarToNameMap[c.avatar] = c.name;
        });
    }

    Object.keys(settings.linkedPresets).forEach(avatarFile => {
        const presetName = settings.linkedPresets[avatarFile];
        // 캐릭터 이름이 있으면 이름, 없으면 파일명 표시
        const displayName = avatarToNameMap[avatarFile] || `(삭제됨/미확인) ${avatarFile}`;

        const itemHtml = `
            <div class="linked-char-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; background: #fff;">
                <div style="font-size: 0.85rem; overflow: hidden;">
                    <div style="font-weight: bold; color: #333;">👤 ${displayName}</div>
                    <div style="color: var(--accent-color); font-size: 0.8rem;">➥ ${presetName}</div>
                </div>
                <button class="delete-link-btn" data-avatar="${avatarFile}" title="연동 해제" style="background: #ff5252; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem;">
                    삭제
                </button>
            </div>
        `;
        $container.append(itemHtml);
    });

    // 동적 생성된 삭제 버튼에 이벤트 연결
    $container.find('.delete-link-btn').on('click', onDeleteLinkedChar);
}

// [신규 기능] 목록에서 연동 삭제
function onDeleteLinkedChar() {
    const avatarFile = $(this).data('avatar');
    if (!avatarFile) return;

    if (confirm('해당 캐릭터의 프리셋 연동을 해제하시겠습니까?')) {
        delete settings.linkedPresets[avatarFile];
        saveSettingsDebounced();
        
        // UI 갱신 (현재 보고 있는 캐릭터일 수도 있으므로 둘 다 갱신)
        renderCharacterLinkUI();
        renderAllLinkedPresetsList();
    }
}

function onSaveCharLink() {
    if (!this_chid || !characters[this_chid]) {
        alert('캐릭터가 로드되지 않았습니다.');
        return;
    }

    const presetName = $('#preset-select-dropdown').val();
    if (!presetName) {
        alert('연동할 프리셋을 목록에서 선택해주세요.');
        return;
    }

    const currentCharacter = characters[this_chid];
    const charId = currentCharacter.avatar;

    // 연동 정보 저장
    if (!settings.linkedPresets) settings.linkedPresets = {};
    settings.linkedPresets[charId] = presetName;

    renderCharacterLinkUI();
    saveSettingsDebounced();
    alert(`[${currentCharacter.name}] 캐릭터가 들어오면 자동으로 [${presetName}] 프리셋이 적용됩니다.`);
}

function onRemoveCharLink() {
    if (!this_chid || !characters[this_chid]) return;

    const currentCharacter = characters[this_chid];
    const charId = currentCharacter.avatar;

    if (settings.linkedPresets && settings.linkedPresets[charId]) {
        if (confirm(`[${currentCharacter.name}] 캐릭터의 프리셋 연동을 해제하시겠습니까?`)) {
            delete settings.linkedPresets[charId];
            renderCharacterLinkUI();
            saveSettingsDebounced();
        }
    }
}

// -----------------------------------------------------------------
// 프리셋 파일 읽기 및 처리 (Import)
// -----------------------------------------------------------------
function onImportPresetFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            processImportedPreset(importedData);
        } catch (err) {
            console.error(err);
            alert('프리셋 파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.');
        }
        // input 초기화 (같은 파일 다시 선택 가능하게)
        event.target.value = '';
    };
    reader.readAsText(file);
}

// -----------------------------------------------------------------
// [신규 기능] 불러온 데이터 로직 처리 (ID 매핑 및 병합)
// -----------------------------------------------------------------
function processImportedPreset(data) {
    // 유효성 검사
    if (!data.presetSettings || !data.stickers) {
        alert('잘못된 프리셋 파일 형식입니다.');
        return;
    }

    const newPresetName = prompt("불러온 프리셋의 이름을 지정해주세요:", data.name || "Imported Preset");
    if (!newPresetName) return; // 취소
    
    // 이름 중복 확인
    if (settings.presets[newPresetName] && !confirm(`[${newPresetName}] 이름의 프리셋이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return;
    }

    const idMapping = {}; // { 가져온파일의ID : 내컴퓨터의실제ID }
    const missingStickers = [];

    // 1. 스티커 목록 동기화 (가장 중요한 부분)
    data.stickers.forEach(importedSticker => {
        // A. 내 저장소에 같은 '이름'을 가진 스티커가 있는지 찾기
        let localSticker = settings.savedStickers.find(s => s.name === importedSticker.name);

        if (localSticker) {
            // [경우 1] 이미 같은 이름의 스티커가 내 목록에 있음 -> 그 ID를 사용
            idMapping[importedSticker.originalId] = localSticker.id;
        } else {
            // [경우 2] 내 목록에 없음
            if (importedSticker.link && importedSticker.link.trim() !== "") {
                // 링크가 있으면 -> 새로 생성하여 저장
                settings.stickerCounter++;
                const newId = settings.stickerCounter;
                
                settings.savedStickers.push({
                    id: newId,
                    name: importedSticker.name,
                    link: importedSticker.link
                });
                
                idMapping[importedSticker.originalId] = newId;
            } else {
                // 링크가 없는데(보안상 제외됨) 내 목록에도 없음 -> 매핑 불가
                missingStickers.push(importedSticker.name);
            }
        }
    });

    // 2. 프리셋 데이터의 activeStickers가 사용하는 ID를 새 ID로 교체
    const newActiveStickers = [];
    if (data.presetSettings.activeStickers) {
        data.presetSettings.activeStickers.forEach(sticker => {
            const remappedId = idMapping[sticker.stickerId];
            if (remappedId) {
                // ID 교체 후 추가
                sticker.stickerId = remappedId;
                // 혹시 모를 팝업 ID 충돌 방지 위해 갱신
                sticker.popupId = `sticker-${remappedId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                newActiveStickers.push(sticker);
            }
        });
    }

    // 3. 데이터 저장
    const finalPreset = data.presetSettings;
    finalPreset.activeStickers = newActiveStickers;
    settings.presets[newPresetName] = finalPreset;

    // 4. UI 갱신 및 결과 알림
    saveSettingsDebounced();
    renderPresetList();
    renderStickerList($('#sticker-search-input').val()); // 스티커 목록도 갱신(새로 추가된게 있을 수 있음)
    
    // 완료 메시지
    let msg = `프리셋 [${newPresetName}] 가져오기 완료!`;
    if (missingStickers.length > 0) {
        msg += `\n\n⚠️ 다음 스티커는 링크가 없고 내 목록에도 없어 제외되었습니다:\n- ${missingStickers.join('\n- ')}`;
    }
    alert(msg);
    
    // 바로 선택해드림
    $('#preset-select-dropdown').val(newPresetName).trigger('change');
}
function onResetPositions() {
    if (!confirm('현재 화면에 부착된 모든 스티커를 제거하고, 캐릭터/페르소나 팝업 위치를 화면 중앙으로 초기화하시겠습니까?')) {
        return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 1. 캐릭터 팝업 중앙 정렬
    const charWidth = settings.charConfig.width || 250;
    const charHeight = settings.charConfig.height || 350;
    
    settings.charPos = {
        top: (viewportHeight / 2) - (charHeight / 2),
        left: (viewportWidth / 2) - (charWidth / 2)
    };

    // 2. 페르소나 팝업 중앙 정렬 (약간 오른쪽으로 엇갈리게 하려면 left에 값을 더해도 됨. 여기선 정중앙 겹침 방지를 위해 약간 오프셋)
    const personaWidth = settings.personaConfig.width || 250;
    const personaHeight = settings.personaConfig.height || 350;

    settings.personaPos = {
        top: (viewportHeight / 2) - (personaHeight / 2),
        left: (viewportWidth / 2) - (personaWidth / 2) + 20 // 20px 살짝 어긋나게
    };

    // 3. 화면의 스티커 모두 제거 (데이터에서도 삭제)
    settings.activeStickers = [];
    $('.sticker-popup').remove();
    hideStickerConfigPanel();

    // 4. 적용
    applyPosToPopup('char');
    applyPosToPopup('persona');
    
    // 기준 뷰포트도 갱신
    settings.initialViewport = { width: viewportWidth, height: viewportHeight };

    alert('초기화되었습니다.');
    saveSettingsDebounced();
}

function updatePresetButtons() {
    const selected = $('#preset-select-dropdown').val();
    const isDisabled = !selected || selected === '기본 설정';
    $('#load-preset-btn').prop('disabled', !selected);
    $('#delete-preset-btn').prop('disabled', isDisabled);
}




function togglePopups(isEnabled) {
    // 1. 전체 기능이 꺼져있으면 모두 숨김
    if (!isEnabled) {
        $('#char-avatar-popup').css('display', 'none');
        $('#persona-avatar-popup').css('display', 'none');
        $('.sticker-popup').css('display', 'none');
        return;
    }

    // 2. 전체 기능이 켜져있다면 개별 설정 확인
    // 캐릭터 팝업
    if (settings.charEnabled !== false) { // undefined일 경우(구버전 호환) true로 취급
        $('#char-avatar-popup').css('display', '');
    } else {
        $('#char-avatar-popup').css('display', 'none');
    }

    // 페르소나 팝업
    if (settings.personaEnabled !== false) {
        $('#persona-avatar-popup').css('display', '');
    } else {
        $('#persona-avatar-popup').css('display', 'none');
    }
    
    // 스티커는 전체 설정(isEnabled)을 따름
    $('.sticker-popup').css('display', '');
}


function createPopup(id, title) {
    if ($(`#${id}`).length) return;

    const $popup = $(`
        <div id="${id}" class="avatar-popup">
            <img src="${DEFAULT_AVATAR_PATH}" alt="${title} Avatar" title="${title} Avatar" data-type="${title.toLowerCase()}">
        </div>
    `);

    $('body').append($popup);
    
    const isChar = (id === 'char-avatar-popup');
    const type = isChar ? 'char' : 'persona';
    
    
    
    
    
    
    
    
    applyConfigToPopup(type);
    
    
    applyPosToPopup(type); 
    
    
    

    $popup.on('click', function(e) {
        
        if (isAvatarDragging || $popup.hasClass('ignore-click')) {
            isAvatarDragging = false; 
            return; 
        }
        onAvatarPopupClick(e);
    });
}

async function updateAvatars() {
    if (!settings.enabled) return;
    
    const currentCharCard = characters[this_chid]; 
    let charPath = DEFAULT_AVATAR_PATH;
    if (currentCharCard && currentCharCard.avatar) {
        charPath = `/thumbnail?type=avatar&file=${currentCharCard.avatar}`;
    }
    if (!settings.charConfig.imageOverride) {
        $('#char-avatar-popup img').attr('src', charPath).show();
    }
    
    let personaPath = DEFAULT_AVATAR_PATH;
    const personaFileName = user_avatar;
    if (personaFileName) {
        if (typeof getThumbnailUrl === 'function') {
            personaPath = getThumbnailUrl('persona', personaFileName, true); 
        } else {
            personaPath = `/thumbnail?type=persona&file=${personaFileName}`; 
        }
    }
    if (!settings.personaConfig.imageOverride) {
        $('#persona-avatar-popup img').attr('src', personaPath).show();
    }
}

function initializePopups() {
    createPopup('char-avatar-popup', 'Character');
    createPopup('persona-avatar-popup', 'Persona');
    
    togglePopups(settings.enabled);
    updateAvatars();

    // 캐릭터 변경 감지 이벤트
    $(document).on('change', '#character_select', () => {
        // 이미지가 로드될 시간을 살짝 주고, 아바타 갱신 및 프리셋 자동 로드 실행
        setTimeout(() => {
            updateAvatars();
            checkAndLoadCharacterPreset(); // [추가됨] 프리셋 자동 로드
            
            // 설정창이 열려있다면 UI도 갱신
            if ($('#avatar-popups-menu-content').is(':visible')) {
                 renderCharacterLinkUI();
            }
        }, 200); 
    });
    
    eventSource.on(event_types.SETTINGS_UPDATED, updateAvatars);
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateAvatars();
        // 채팅방이 바뀌었을 때도 캐릭터가 변경되었을 수 있으므로 체크
        setTimeout(checkAndLoadCharacterPreset, 200);
    });
}


jQuery(async () => {
    initializePopups(); 
    createStickerConfigPanel(); 
	createAvatarConfigPanel();
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
		$("#extensions_settings2").append(settingsHtml);
        
        
        $('#avatar_popups_enable_toggle').on('change', onEnableToggle);
        $('#avatar_popups_ignore_click_toggle').on('change', onIgnoreClickToggle); 
        
        $('#avatar_popups_auto_adjust_toggle').on('change', onAutoPosAdjustToggle);
        
        
        $('.avatar-config-input').on('input', onAvatarConfigInput);

        
        $('#avatar-persona-tab-container').find('.tab').on('click', onTabClick);
        
        
        $('#toggle-add-sticker-input-btn').on('click', function() {
            const $popup = $('#add-sticker-input-popup');
            const isHidden = $popup.is(':hidden');
            $popup.toggle();
            $(this).text(isHidden ? '👆 스티커 정보 입력 창 닫기' : '새 스티커 팝업 저장 및 추가');
        });
        $('#save-new-sticker-btn').on('click', onSaveNewSticker);
        $('#add-sticker-folder-btn').on('click', onAddFolder);
        $('#toggle-sticker-edit-mode-btn').on('click', onToggleStickerEditMode);
        $('#sticker-search-input').on('input', function() {
            const query = $(this).val();
            renderStickerList(query);
        });
        $('.main-nav-item').on('click', function() {
            // 1. 모든 탭 버튼 비활성화
            $('.main-nav-item').removeClass('active');
            // 2. 현재 클릭한 탭 활성화
            $(this).addClass('active');
            
            // 3. 탭 ID 가져오기
            const targetTabId = $(this).data('tab');
            
            // 4. 모든 컨텐츠 숨기기
            $('.main-tab-content').removeClass('active');
            // 5. 타겟 컨텐츠 보이기
            $('#' + targetTabId).addClass('active');
        });
        
        $('#save-preset-btn').on('click', onSavePreset);
        
        $('#reset-positions-btn').on('click', onResetPositions);
        $('#save-preset-btn').on('click', onSavePreset);
        $('#load-preset-btn').on('click', onLoadPreset);
        $('#delete-preset-btn').on('click', onDeletePreset);
        $('#preset-select-dropdown').on('change', function() {
            updatePresetButtons();
            // 내보내기 버튼 상태도 업데이트
            const selected = $(this).val();
            $('#export-preset-btn').prop('disabled', !selected);
        });

        // 내보내기/불러오기 이벤트 연결
        $('#export-preset-btn').on('click', onExportPreset);
        $('#import-preset-btn').on('click', () => $('#import-preset-file-input').click());
        $('#import-preset-file-input').on('change', onImportPresetFile);
        $('#save-char-link-btn').on('click', onSaveCharLink);
        $('#remove-char-link-btn').on('click', onRemoveCharLink);
        $('#refresh-char-info-btn').on('click', function() {
            renderCharacterLinkUI();
            // 시각적 피드백
            const $btn = $(this);
            $btn.css('transform', 'rotate(360deg)').css('transition', 'transform 0.5s');
            setTimeout(() => { $btn.css('transform', '').css('transition', ''); }, 500);
        });

        // [신규] 연동 목록 토글 버튼
        $('#toggle-linked-list-btn').on('click', function() {
            const $list = $('#linked-char-list-container');
            if ($list.is(':visible')) {
                $list.slideUp(200);
                $(this).text('📋 연동된 모든 캐릭터 목록 관리 (열기)');
            } else {
                renderAllLinkedPresetsList(); // 열 때 최신화
                $list.slideDown(200);
                $(this).text('📋 연동된 모든 캐릭터 목록 관리 (닫기)');
            }
        });
        // 탭이 'presets'일 때 연동 UI 갱신 (탭 클릭 이벤트 내부가 아니라, loadSettingsUI 호출 시점 등에서 처리되도록 아래에 추가)
        $('#avatar-popups-menu-content .main-nav-item[data-tab="tab-presets"]').on('click', function() {
            renderCharacterLinkUI();
        });
        const originalLoadSettingsUI = loadSettingsUI;
        loadSettingsUI = function() {
            originalLoadSettingsUI();
            renderCharacterLinkUI();
        };
        loadSettingsUI();
        
    } catch (error) {
        console.warn(`[${extensionName}] settings.html 불러오기 실패`, error);
    }

    console.log('AvatarPopups extension initialized.');
});