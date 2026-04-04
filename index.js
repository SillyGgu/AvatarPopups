import {
    eventSource,
    event_types,
    saveSettingsDebounced,
    characters,
    this_chid,
    getThumbnailUrl
} from '../../../../script.js';

import { 
    getContext,
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js'; 

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
            if (sticker.opacity === undefined) {
                sticker.opacity = 1;
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
        $charPopup.addClass('floating-char').css('position', 'fixed');
        $personaPopup.addClass('floating-persona').css('position', 'fixed');
    } else {
        $charPopup.removeClass('floating-char').css('position', 'fixed');
        $personaPopup.removeClass('floating-persona').css('position', 'fixed');
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

    // draggable 재초기화 후 floating 상태 복원
    toggleFloating(settings.isFloating);
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
                'z-index': activeSticker.zIndex || 1000,
                'opacity': activeSticker.opacity !== undefined ? activeSticker.opacity : 1
            });
            
            const flipTransform = activeSticker.isFlipped ? 'scaleX(-1)' : 'none';
            $popup.find('img').css('transform', flipTransform);
            
            $popup.on('click', function(event) {
                const $img = $(this).find('img')[0];
                if (!$img || !$img.complete) {
                    onStickerPopupClick.call(this, event);
                    return;
                }

                const rect = $img.getBoundingClientRect();
                const clickX = event.clientX - rect.left;
                const clickY = event.clientY - rect.top;

                const canvas = document.createElement('canvas');
                canvas.width = $img.naturalWidth || $img.width;
                canvas.height = $img.naturalHeight || $img.height;
                const ctx = canvas.getContext('2d');

                try {
                    ctx.drawImage($img, 0, 0, canvas.width, canvas.height);
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const pixelX = Math.floor(clickX * scaleX);
                    const pixelY = Math.floor(clickY * scaleY);
                    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
                    const alpha = pixel[3];

                    if (alpha < 10) {
                        return; // 투명 영역 클릭 무시
                    }
                } catch (e) {
                    // CORS 문제 등으로 canvas 읽기 실패 시 그냥 통과
                }

                onStickerPopupClick.call(this, event);
            });
            
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
    
    if (isStickerMovingMode) {
        $container.addClass('sticker-list-moving-mode');
    } else {
        $container.removeClass('sticker-list-moving-mode');
    }

    const query = searchQuery.trim().toLowerCase();
    
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
    
    if (!settings.stickerFolders) {
        settings.stickerFolders = ['전체', '기본'];
    }
    settings.savedStickers.forEach(s => {
        if (!s.folder) s.folder = '기본';
    });

    renderStickerFolders(); 
    renderStickerList();   
    renderActiveStickers(); 

    renderPresetList();
    updatePresetButtons();

    toggleClickIgnore(settings.ignoreClick);
    toggleFloating(settings.isFloating);
    renderCharacterLinkUI();
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
    $container.find('.sticker-folder-tab').remove();

    settings.stickerFolders.forEach(folderName => {
        const isActive = (folderName === currentSelectedFolder) ? 'active' : '';
        const tabHtml = `<div class="sticker-folder-tab ${isActive}" data-folder="${folderName}">${folderName}</div>`;
        
        $('#add-sticker-folder-btn').before(tabHtml);
    });

    $('.sticker-folder-tab').off('click').on('click', function() {
        const folder = $(this).data('folder');
        currentSelectedFolder = folder;
        renderStickerFolders(); 
        renderStickerList($('#sticker-search-input').val()); 
    });

    $('.sticker-folder-tab').on('contextmenu', function(e) {
        e.preventDefault();
        const folder = $(this).data('folder');
        if (folder === '전체' || folder === '기본') return;

        if (confirm(`폴더 [${folder}]를 삭제하시겠습니까?\n(내부의 스티커는 '기본' 폴더로 이동됩니다)`)) {
            settings.savedStickers.forEach(s => {
                if (s.folder === folder) s.folder = '기본';
            });
            settings.stickerFolders = settings.stickerFolders.filter(f => f !== folder);
            
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
    
    currentSelectedFolder = trimmed;
    renderStickerFolders();
    renderStickerList();
}

// -------------------------------------------------------
// 폴더(탭) 관리자 로직
// -------------------------------------------------------

function onManageFolders() {
    renderFolderManagerList();
    $('#folder-manager-modal-overlay').css('display', 'flex');
}

function onCloseManageFolders() {
    $('#folder-manager-modal-overlay').hide();
    if (!settings.stickerFolders.includes(currentSelectedFolder)) {
        currentSelectedFolder = '전체';
    }
    renderStickerFolders();
    renderStickerList($('#sticker-search-input').val());
}

function renderFolderManagerList() {
    const $list = $('#folder-manager-list-area');
    $list.empty();

    settings.stickerFolders.forEach((folderName, index) => {
        const isAll = (folderName === '전체');
        const isDefault = (folderName === '기본');
        const isProtected = isAll || isDefault;

        const $item = $(`
            <div class="folder-manager-item ${isProtected ? 'protected' : ''}">
                <div style="font-weight: 500; color: #333;">
                    ${index + 1}. ${folderName} ${isAll ? '(고정)' : ''}
                </div>
                <div class="folder-manager-controls">
                    ${!isAll ? `<button class="folder-btn move-up-btn" title="위로">▲</button>` : ''}
                    ${!isAll ? `<button class="folder-btn move-down-btn" title="아래로">▼</button>` : ''}
                    ${!isAll ? `<button class="folder-btn rename-btn" title="이름 변경">✏️</button>` : ''}
                    ${(!isProtected) ? `<button class="folder-btn delete-btn" title="삭제 (스티커는 기본 폴더로 이동)">🗑️</button>` : ''}
                </div>
            </div>
        `);

        if (!isAll) {
            $item.find('.move-up-btn').on('click', () => moveFolderOrder(index, -1));
            $item.find('.move-down-btn').on('click', () => moveFolderOrder(index, 1));
            $item.find('.rename-btn').on('click', () => renameFolder(index));
        }
        if (!isProtected) {
            $item.find('.delete-btn').on('click', () => deleteFolder(index));
        }

        $list.append($item);
    });
}

function moveFolderOrder(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex <= 0 || targetIndex >= settings.stickerFolders.length) return;

    const temp = settings.stickerFolders[index];
    settings.stickerFolders[index] = settings.stickerFolders[targetIndex];
    settings.stickerFolders[targetIndex] = temp;

    saveSettingsDebounced();
    renderFolderManagerList();
}

function renameFolder(index) {
    const oldName = settings.stickerFolders[index];
    const newName = prompt(`폴더 [${oldName}]의 새 이름을 입력하세요:`, oldName);
    
    if (!newName) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    if (settings.stickerFolders.includes(trimmed)) {
        alert('이미 존재하는 폴더 이름입니다.');
        return;
    }

    settings.stickerFolders[index] = trimmed;

    settings.savedStickers.forEach(sticker => {
        if (sticker.folder === oldName) {
            sticker.folder = trimmed;
        }
    });

    if (currentSelectedFolder === oldName) {
        currentSelectedFolder = trimmed;
    }

    saveSettingsDebounced();
    renderFolderManagerList();
}

function deleteFolder(index) {
    const folderName = settings.stickerFolders[index];
    if (folderName === '전체' || folderName === '기본') {
        alert('이 폴더는 삭제할 수 없습니다.');
        return;
    }

    if (!confirm(`폴더 [${folderName}]를 삭제하시겠습니까?\n\n⚠️ 주의: 이 폴더에 있던 모든 스티커는 '기본' 폴더로 이동됩니다.`)) {
        return;
    }

    let movedCount = 0;
    settings.savedStickers.forEach(sticker => {
        if (sticker.folder === folderName) {
            sticker.folder = '기본';
            movedCount++;
        }
    });

    settings.stickerFolders.splice(index, 1);

    if (currentSelectedFolder === folderName) {
        currentSelectedFolder = '전체';
    }

    saveSettingsDebounced();
    renderFolderManagerList();
    alert(`폴더가 삭제되었습니다. 스티커 ${movedCount}개가 '기본' 폴더로 이동되었습니다.`);
}
// -------------------------------------------------------

function onToggleStickerEditMode() {
    if (isStickerMovingMode && selectedStickersForMove.size > 0) {
        showFolderSelectionModal();
        return;
    }

    isStickerMovingMode = !isStickerMovingMode;
    const $btn = $('#toggle-sticker-edit-mode-btn');
    
    if (isStickerMovingMode) {
        selectedStickersForMove.clear(); 
        $btn.addClass('active');
        $btn.html('💾 완료'); 
        $('#sticker-move-instruction').text('(스티커를 클릭해 선택 후, 완료 버튼을 누르세요)').show();
        $('#sticker-search-input').prop('disabled', true);
    } else {
        selectedStickersForMove.clear(); 
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
    
    if (selectedStickersForMove.has(stickerId)) {
        selectedStickersForMove.delete(stickerId);
        $item.removeClass('selected');
    } else {
        selectedStickersForMove.add(stickerId);
        $item.addClass('selected');
    }

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
    
    $('#sticker-move-count-msg').text(`총 ${selectedStickersForMove.size}개의 스티커를 어디로 옮길까요?`);
    $listArea.empty();
    const targetFolders = settings.stickerFolders.filter(f => f !== '전체');

    targetFolders.forEach(folderName => {
        const btn = $(`<button class="sticker-move-folder-btn">📁 ${folderName}</button>`);
        btn.on('click', () => executeBatchMove(folderName));
        $listArea.append(btn);
    });

    $modalOverlay.css('display', 'flex'); 
    
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

    selectedStickersForMove.clear();
    closeFolderSelectionModal();

    onToggleStickerEditMode(); 

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
    
    const targetFolder = (currentSelectedFolder === '전체') ? '기본' : currentSelectedFolder;

    settings.stickerCounter++;
    settings.savedStickers.push({
        id: settings.stickerCounter,
        name: name,
        link: link,
        folder: targetFolder 
    });

    
    $('#sticker-name-input').val('');
    $('#sticker-image-link-input').val('');
    $('#add-sticker-input-popup').hide(); 
    $('#toggle-add-sticker-input-btn').text('새 스티커 팝업 저장 및 추가');
    
    renderStickerList($('#sticker-search-input').val()); 
    saveSettingsDebounced();

    alert(`[${targetFolder}] 폴더에 저장되었습니다.`);
}

function onSaveBulkStickers() {
    const raw = $('#sticker-bulk-input').val();
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
        alert('입력된 내용이 없습니다.');
        return;
    }

    const targetFolder = (currentSelectedFolder === '전체') ? '기본' : currentSelectedFolder;
    let successCount = 0;
    let failLines = [];

    lines.forEach((line, idx) => {
        const pipeIdx = line.indexOf('|');
        if (pipeIdx === -1) {
            failLines.push(`${idx + 1}번째 줄: 구분자(|) 없음`);
            return;
        }
        const name = line.substring(0, pipeIdx).trim();
        const link = line.substring(pipeIdx + 1).trim();

        if (!name || !link) {
            failLines.push(`${idx + 1}번째 줄: 이름 또는 링크 비어있음`);
            return;
        }

        settings.stickerCounter++;
        settings.savedStickers.push({
            id: settings.stickerCounter,
            name: name,
            link: link,
            folder: targetFolder
        });
        successCount++;
    });

    saveSettingsDebounced();
    renderStickerList($('#sticker-search-input').val());

    $('#sticker-bulk-input').val('');
    $('#sticker-bulk-preview').text('');

    let msg = `✅ ${successCount}개 스티커가 [${targetFolder}] 폴더에 저장되었습니다.`;
    if (failLines.length > 0) {
        msg += `\n\n⚠️ 저장 실패 (${failLines.length}개):\n` + failLines.join('\n');
    }
    alert(msg);
}

function onReloadPopups() {
    const $btn = $('#reload-popups-btn');
    $btn.text('⏳').prop('disabled', true);

    // 기존 팝업 제거 후 재생성
    $('#char-avatar-popup, #persona-avatar-popup').remove();
    $('.sticker-popup').remove();

    setTimeout(() => {
        initializePopups();
        renderActiveStickers();
        $btn.text('↺').prop('disabled', false);
    }, 300);
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
        opacity: 1,
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
        } else if (key === 'opacity') {
            settings.activeStickers[activeStickerIndex].opacity = value;
            $popup.css('opacity', value);
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

            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">불투명도 (<span id="sticker-opacity-value-display">100</span>%)</label>
                <input type="range" id="sticker-opacity-input" class="sticker-config-input" data-key="opacity" min="0" max="1" step="0.01" style="width: 100%; margin-bottom: 10px;">
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

        if (key === 'opacity') {
            let value = parseFloat($input.val());
            if (isNaN(value)) value = 1;
            value = Math.min(1, Math.max(0, value));
            $('#sticker-opacity-value-display').text(Math.round(value * 100));
            updateStickerConfig(currentEditingStickerPopupId, key, value);
            return;
        }

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
    
    const opacityVal = activeSticker.opacity !== undefined ? activeSticker.opacity : 1;
    $('#sticker-opacity-input').val(opacityVal);
    $('#sticker-opacity-value-display').text(Math.round(opacityVal * 100));
    
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
		const axis = $btn.data('axis'); 
		const dir = parseInt($btn.data('val'));
		
		const step = (parseInt($('#avatar-adjust-dpad-step').val()) || 5) * 2; 
		
		let config = settings[`${currentEditingAvatarType}Config`];
		if (!config.imageAdjust) {
			config.imageAdjust = { x: 0, y: 0, zoom: 1, rotation: 0 };
		}
		
		let currentVal = config.imageAdjust[axis] || 0;
		
		if (axis === 'y' || axis === 'x') {
			currentVal += dir * step; 
		}
		
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

function onLoadPreset() {
    const presetName = $('#preset-select-dropdown').val();
    
    if (applyPreset(presetName)) {
        alert(`프리셋 [${presetName}]을(를) 불러왔습니다.`);
        saveSettingsDebounced();
    }
}

function checkAndLoadCharacterPreset() {
    if (!settings.enabled || !this_chid || !characters[this_chid]) return;

    const currentCharacter = characters[this_chid];
    const charId = currentCharacter.avatar; 
    
    if (settings.linkedPresets && settings.linkedPresets[charId]) {
        const targetPresetName = settings.linkedPresets[charId];
        
        if (settings.presets[targetPresetName]) {
            console.log(`[AvatarPopups] Auto-loading preset '${targetPresetName}' for character '${currentCharacter.name}'`);
            applyPreset(targetPresetName);
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

    const usedStickerIds = new Set();
    if (presetData.activeStickers) {
        presetData.activeStickers.forEach(s => usedStickerIds.add(s.stickerId));
    }

    const stickerDefinitions = [];
    usedStickerIds.forEach(id => {
        const found = settings.savedStickers.find(s => s.id === id);
        if (found) {
            stickerDefinitions.push({
                originalId: id, 
                name: found.name,
                link: includeLinks ? found.link : "" 
            });
        }
    });

    const exportObject = {
        meta: {
            version: "1.0",
            exportedAt: Date.now(),
            includeLinks: includeLinks
        },
        name: presetName,
        presetSettings: presetData,
        stickers: stickerDefinitions 
    };

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

    let statusHtml = `<strong>현재 캐릭터:</strong> ${charName}<br>`;
    
    if (linkedPreset && settings.presets[linkedPreset]) {
        statusHtml += `<strong>연동된 프리셋:</strong> <span style="color: var(--accent-color);">${linkedPreset}</span>`;
        $('#remove-char-link-btn').prop('disabled', false);
        
        const $dropdown = $('#preset-select-dropdown');
        if ($dropdown.val() !== linkedPreset) {
             $dropdown.val(linkedPreset);
             updatePresetButtons();
        }
    } else {
        statusHtml += `<strong>연동 상태:</strong> <span style="color: #999;">없음 (프리셋 선택 후 '연동 저장' 클릭)</span>`;
        $('#remove-char-link-btn').prop('disabled', true);
    }

    $('#char-link-info-area').html(statusHtml);
    $('#save-char-link-btn').prop('disabled', false);
    
    renderAllLinkedPresetsList();
}

function renderAllLinkedPresetsList() {
    const $container = $('#linked-char-list-container');
    $container.empty();

    if (!settings.linkedPresets || Object.keys(settings.linkedPresets).length === 0) {
        $container.append('<div style="padding: 10px; text-align: center; color: #999; font-size: 0.8rem;">연동된 캐릭터가 없습니다.</div>');
        return;
    }

    const avatarToNameMap = {};
    if (Array.isArray(characters)) {
        characters.forEach(c => {
            if (c.avatar) avatarToNameMap[c.avatar] = c.name;
        });
    }

    Object.keys(settings.linkedPresets).forEach(avatarFile => {
        const presetName = settings.linkedPresets[avatarFile];
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

    $container.find('.delete-link-btn').on('click', onDeleteLinkedChar);
}

function onDeleteLinkedChar() {
    const avatarFile = $(this).data('avatar');
    if (!avatarFile) return;

    if (confirm('해당 캐릭터의 프리셋 연동을 해제하시겠습니까?')) {
        delete settings.linkedPresets[avatarFile];
        saveSettingsDebounced();
        
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
        event.target.value = '';
    };
    reader.readAsText(file);
}

// -----------------------------------------------------------------
// 불러온 데이터 로직 처리 (ID 매핑 및 병합)
// -----------------------------------------------------------------
function processImportedPreset(data) {
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

    const idMapping = {}; 
    const missingStickers = [];

    data.stickers.forEach(importedSticker => {
        let localSticker = settings.savedStickers.find(s => s.name === importedSticker.name);

        if (localSticker) {
            idMapping[importedSticker.originalId] = localSticker.id;
        } else {
            if (importedSticker.link && importedSticker.link.trim() !== "") {
                settings.stickerCounter++;
                const newId = settings.stickerCounter;
                
                settings.savedStickers.push({
                    id: newId,
                    name: importedSticker.name,
                    link: importedSticker.link
                });
                
                idMapping[importedSticker.originalId] = newId;
            } else {
                missingStickers.push(importedSticker.name);
            }
        }
    });

    const newActiveStickers = [];
    if (data.presetSettings.activeStickers) {
        data.presetSettings.activeStickers.forEach(sticker => {
            const remappedId = idMapping[sticker.stickerId];
            if (remappedId) {
                sticker.stickerId = remappedId;
                sticker.popupId = `sticker-${remappedId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                newActiveStickers.push(sticker);
            }
        });
    }

    const finalPreset = data.presetSettings;
    finalPreset.activeStickers = newActiveStickers;
    settings.presets[newPresetName] = finalPreset;

    saveSettingsDebounced();
    renderPresetList();
    renderStickerList($('#sticker-search-input').val()); 
    
    let msg = `프리셋 [${newPresetName}] 가져오기 완료!`;
    if (missingStickers.length > 0) {
        msg += `\n\n⚠️ 다음 스티커는 링크가 없고 내 목록에도 없어 제외되었습니다:\n- ${missingStickers.join('\n- ')}`;
    }
    alert(msg);
    
    $('#preset-select-dropdown').val(newPresetName).trigger('change');
}
function onResetPositions() {
    if (!confirm('현재 화면에 부착된 모든 스티커를 제거하고, 캐릭터/페르소나 팝업 위치를 화면 중앙으로 초기화하시겠습니까?')) {
        return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const charWidth = settings.charConfig.width || 250;
    const charHeight = settings.charConfig.height || 350;
    
    settings.charPos = {
        top: (viewportHeight / 2) - (charHeight / 2),
        left: (viewportWidth / 2) - (charWidth / 2)
    };

    const personaWidth = settings.personaConfig.width || 250;
    const personaHeight = settings.personaConfig.height || 350;

    settings.personaPos = {
        top: (viewportHeight / 2) - (personaHeight / 2),
        left: (viewportWidth / 2) - (personaWidth / 2) + 20 
    };

    settings.activeStickers = [];
    $('.sticker-popup').remove();
    hideStickerConfigPanel();

    toggleFloating(settings.isFloating);

    applyPosToPopup('char');
    applyPosToPopup('persona');
    
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
    if (!isEnabled) {
        $('#char-avatar-popup').css('display', 'none');
        $('#persona-avatar-popup').css('display', 'none');
        $('.sticker-popup').css('display', 'none');
        return;
    }

    if (settings.charEnabled !== false) { 
        $('#char-avatar-popup').css('display', '');
    } else {
        $('#char-avatar-popup').css('display', 'none');
    }

    if (settings.personaEnabled !== false) {
        $('#persona-avatar-popup').css('display', '');
    } else {
        $('#persona-avatar-popup').css('display', 'none');
    }
    
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

    $(document).on('change', '#character_select', () => {
        setTimeout(() => {
            updateAvatars();
            checkAndLoadCharacterPreset(); 
            
            if ($('#avatar-popups-menu-content').is(':visible')) {
                 renderCharacterLinkUI();
            }
        }, 200); 
    });
    
    eventSource.on(event_types.SETTINGS_UPDATED, updateAvatars);
    eventSource.on(event_types.CHAT_CHANGED, () => {
        updateAvatars();
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

        // 단일/일괄 탭 전환
        $('#sticker-input-tab-single').on('click', function() {
            $('#sticker-single-panel').show();
            $('#sticker-bulk-panel').hide();
            $(this).css({ background: '#c2185b', color: '#fff' });
            $('#sticker-input-tab-bulk').css({ background: '#f0e0ea', color: '#c2185b' });
        });
        $('#sticker-input-tab-bulk').on('click', function() {
            $('#sticker-bulk-panel').show();
            $('#sticker-single-panel').hide();
            $(this).css({ background: '#c2185b', color: '#fff' });
            $('#sticker-input-tab-single').css({ background: '#f0e0ea', color: '#c2185b' });
        });

        // 일괄 입력 실시간 미리보기
        $('#sticker-bulk-input').on('input', function() {
            const lines = $(this).val().split('\n').filter(l => l.trim().length > 0);
            const valid = lines.filter(l => l.includes('|')).length;
            $('#sticker-bulk-preview').text(lines.length > 0 ? `${lines.length}줄 입력됨 (유효: ${valid}개)` : '');
        });

        $('#save-bulk-sticker-btn').on('click', onSaveBulkStickers);

        // 포카 새로고침
        $('#reload-popups-btn').on('click', onReloadPopups);
        $('#add-sticker-folder-btn').on('click', onAddFolder);
        
        $('#manage-sticker-folders-btn').on('click', onManageFolders);
        $('#close-folder-manager-btn').on('click', onCloseManageFolders);
        
        $('#toggle-sticker-edit-mode-btn').on('click', onToggleStickerEditMode);
        $('#sticker-search-input').on('input', function() {
            const query = $(this).val();
            renderStickerList(query);
        });
        $('.main-nav-item').on('click', function() {
            $('.main-nav-item').removeClass('active');
            $(this).addClass('active');
            
            const targetTabId = $(this).data('tab');
            
            $('.main-tab-content').removeClass('active');
            $('#' + targetTabId).addClass('active');
        });
        
        $('#save-preset-btn').on('click', onSavePreset);
        
        $('#reset-positions-btn').on('click', onResetPositions);
        $('#load-preset-btn').on('click', onLoadPreset);
        $('#delete-preset-btn').on('click', onDeletePreset);
        $('#preset-select-dropdown').on('change', function() {
            updatePresetButtons();
            const selected = $(this).val();
            $('#export-preset-btn').prop('disabled', !selected);
        });

        $('#export-preset-btn').on('click', onExportPreset);
        $('#import-preset-btn').on('click', () => $('#import-preset-file-input').click());
        $('#import-preset-file-input').on('change', onImportPresetFile);
        $('#save-char-link-btn').on('click', onSaveCharLink);
        $('#remove-char-link-btn').on('click', onRemoveCharLink);
        $('#refresh-char-info-btn').on('click', function() {
            renderCharacterLinkUI();
            const $btn = $(this);
            $btn.css('transform', 'rotate(360deg)').css('transition', 'transform 0.5s');
            setTimeout(() => { $btn.css('transform', '').css('transition', ''); }, 500);
        });

        $('#toggle-linked-list-btn').on('click', function() {
            const $list = $('#linked-char-list-container');
            if ($list.is(':visible')) {
                $list.slideUp(200);
                $(this).text('📋 연동된 모든 캐릭터 목록 관리 (열기)');
            } else {
                renderAllLinkedPresetsList(); 
                $list.slideDown(200);
                $(this).text('📋 연동된 모든 캐릭터 목록 관리 (닫기)');
            }
        });
        $('#avatar-popups-menu-content .main-nav-item[data-tab="tab-presets"]').on('click', function() {
            renderCharacterLinkUI();
        });
        // 스티커/포카 툴창 — 외부 클릭 시 자동 닫기
        $(document).on('click.avatarPopupsDeselect', function(e) {
            const $target = $(e.target);

            // 툴창 자체, 스티커 팝업, 포카 팝업, 설정 패널 클릭이면 무시
            const isInsidePanel = $target.closest('#sticker-config-panel, #avatar-config-panel').length > 0;
            const isInsidePopup = $target.closest('.sticker-popup, #char-avatar-popup, #persona-avatar-popup').length > 0;
            const isInsideSettings = $target.closest('.avatar-popups-settings').length > 0;

            if (isInsidePanel || isInsidePopup || isInsideSettings) return;

            // 스티커 툴창이 열려있으면 닫기
            if ($('#sticker-config-panel').is(':visible')) {
                hideStickerConfigPanel();
            }

            // 포카 툴창이 열려있으면 닫기
            if ($('#avatar-config-panel').is(':visible')) {
                hideAvatarConfigPanel();
            }
        });
		
        loadSettingsUI();
        
    } catch (error) {
        console.warn(`[${extensionName}] settings.html 불러오기 실패`, error);
    }

    console.log('AvatarPopups extension initialized.');
});