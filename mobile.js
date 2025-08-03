// 유틸 함수: 스타일 일괄 적용
function applyStyles(element, styles) {
	Object.assign(element.style, styles);
}

// 전체화면 버튼 생성
function createFullscreenButton() {
	const btn = document.createElement("button");

	const enterIcon = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
            <path d='m15 15 6 6'/>
            <path d='m15 9 6-6'/>
            <path d='M21 16.2V21h-4.8'/>
            <path d='M21 7.8V3h-4.8'/>
            <path d='M3 16.2V21h4.8'/>
            <path d='m3 21 6-6'/>
            <path d='M3 7.8V3h4.8'/>
            <path d='M9 9 3 3'/>
        </svg>
    `)}`;
	const exitIcon = `data:image/svg+xml;base64,${btoa(`
        <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>
            <path d='m15 15 6 6m-6-6v4.8m0-4.8h4.8'/>
            <path d='M9 19.8V15m0 0H4.2M9 15l-6 6'/>
            <path d='M15 4.2V9m0 0h4.8M15 9l6-6'/>
            <path d='M9 4.2V9m0 0H4.2M9 9 3 3'/>
        </svg>
    `)}`;

	const iconImg = document.createElement("img");
	iconImg.src = enterIcon;
	iconImg.alt = "fullscreen icon";
	iconImg.style.width = "20px";
	iconImg.style.height = "20px";

	btn.appendChild(iconImg);
	applyStyles(btn, {
		all: "unset",
		position: "absolute",
		bottom: "10px",
		right: "10px",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: "4px",
		padding: "4px",
		cursor: "pointer",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		opacity: "0",
		transition: "opacity 0.3s",
		pointerEvents: "none",
		zIndex: "3",
	});
	btn._iconEnter = enterIcon;
	btn._iconExit = exitIcon;
	btn._iconImg = iconImg;
	return btn;
}

// iframe에 버튼 붙이기
function setIframeAttributesAndAddButton(iframe) {
	const src = iframe.getAttribute("src");
	if (!src?.startsWith("https://player.vimeo.com")) return;

	const url = new URL(src);
	url.searchParams.set("controls", "0");
	url.searchParams.set("autoplay", "0");
	iframe.setAttribute("src", url.toString());

	const fullscreenUrl = new URL(src);
	fullscreenUrl.searchParams.set("controls", "1");
	fullscreenUrl.searchParams.set("autoplay", "1");
	fullscreenUrl.searchParams.set("muted", "1");

	const wrapper = iframe.parentElement?.parentElement;
	if (!wrapper) return;

	// 중복 방지: 이미 버튼이 존재하는지 확인
	const existingBtn = wrapper.querySelector(".vimeo-enhance-fullscreen");
	if (existingBtn) existingBtn.remove();

	const fullscreenBtn = createFullscreenButton();
	fullscreenBtn.addEventListener("click", async () => {
		try {
			const { player, iframe } = addVimeoPlayerToFullscreenDiv(src);

			const paused = await player.getPaused();
			console.log(`play 시작`);
			console.log(`paused:`, paused);
			if (paused) await player.play();
			console.log(`setVolume 시작`);
			await player.setVolume(0.75);
			console.log(`requestFullscreen 시작`);
			await player.requestFullscreen();
			iframe.style.opacity = "1";
		} catch (error) {
			console.error(`에러 발생:`, error);
		}
		console.log(`=== 끝 ===`);
	});
	fullscreenBtn.classList.add("vimeo-enhance-fullscreen");

	const touchCatcher = document.createElement("div");
	applyStyles(touchCatcher, {
		position: "absolute",
		top: "0",
		left: "0",
		right: "0",
		bottom: "0",
		background: "transparent",
		pointerEvents: "auto",
		opacity: "0",
		zIndex: "2",
	});
	wrapper.appendChild(touchCatcher);
	wrapper.appendChild(fullscreenBtn);

	let hideTimeout;
	const showButton = () => {
		fullscreenBtn.style.opacity = "1";
		fullscreenBtn.style.pointerEvents = "auto";
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(hideButton, 3000);
	};
	const hideButton = () => {
		fullscreenBtn.style.opacity = "0";
		fullscreenBtn.style.pointerEvents = "none";
	};
	wrapper.addEventListener("mousemove", showButton, { capture: true });
	wrapper.addEventListener("mouseenter", showButton, { capture: true });
	wrapper.addEventListener("mouseleave", hideButton);
	wrapper.addEventListener("touchstart", showButton, { capture: true });
}

// Shadow DOM 내부 iframe 처리
function handleShadowRoot(shadowRoot) {
	if (!shadowRoot || shadowRoot.__fullscreenHandled) return;
	shadowRoot.__fullscreenHandled = true;
	const processedIframes = new WeakSet();
	function scanAndProcessIframes() {
		const iframes = shadowRoot.querySelectorAll('iframe[id^="vimeo-player"]');
		for (const iframe of iframes) {
			if (!processedIframes.has(iframe)) {
				setIframeAttributesAndAddButton(iframe);
				processedIframes.add(iframe);
			}
		}
	}
	scanAndProcessIframes();
	const observer = new MutationObserver((mutations) => {
		for (const { addedNodes } of mutations) {
			for (const node of addedNodes) {
				if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IFRAME") {
					if (!processedIframes.has(node)) {
						setIframeAttributesAndAddButton(node);
						processedIframes.add(node);
					}
				}
			}
		}
	});
	observer.observe(shadowRoot, { childList: true, subtree: true });
}

// media-item 처리
function handleMediaItem(item) {
	const tryAttach = () => {
		if (item.shadowRoot) {
			handleShadowRoot(item.shadowRoot);
			return true;
		}
		return false;
	};
	if (tryAttach()) return;
	const interval = setInterval(() => {
		if (tryAttach()) {
			clearInterval(interval);
		}
	}, 100);
}

document.addEventListener("fullscreenchange", () => {
	const isFullscreen = !!document.fullscreenElement;
	if (!isFullscreen) {
		removeVimeoPlayerFromFullscreenDiv();
	}
});

// stacked-page 내부 감시
function observeStackedPageContents(stackedPage) {
	const initialItems = stackedPage.querySelectorAll("media-item");
	for (const item of initialItems) {
		handleMediaItem(item);
	}
	const observer = new MutationObserver((mutations) => {
		for (const { addedNodes } of mutations) {
			for (const node of addedNodes) {
				const nestedItems = node.querySelectorAll?.("media-item") || [];
				for (const nested of nestedItems) {
					handleMediaItem(nested);
				}
			}
		}
	});
	observer.observe(stackedPage, { childList: true, subtree: true });
}

// 전체 페이지 감시
function observeStackedPageContainers() {
	const existing = document.querySelectorAll("div.page.stacked-page");
	for (const page of existing) {
		observeStackedPageContents(page);
	}
	const observer = new MutationObserver((mutations) => {
		for (const { addedNodes } of mutations) {
			for (const node of addedNodes) {
				if (
					node.nodeType === Node.ELEMENT_NODE &&
					node.tagName === "DIV" &&
					node.classList.contains("page") &&
					node.classList.contains("stacked-page")
				) {
					observeStackedPageContents(node);
				}
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true });
}

function addFullscreenDiv() {
	const div = document.createElement("div");
	div.id = "fullscreen-div";
	div.style.position = "fixed";
	div.style.top = "0";
	div.style.left = "0";
	div.style.width = "100%";
	div.style.height = "100%";
	div.style.zIndex = "9999";
	div.style.pointerEvents = "none";
	document.body.appendChild(div);
}

function getFullscreenDiv() {
	return document.getElementById("fullscreen-div");
}

function addVimeoPlayerToFullscreenDiv(src) {
	const div = getFullscreenDiv();
	if (!div) return;
	const id = getVimeoIdFromSrc(src);
	const iframe = document.createElement("iframe");
	iframe.id = id;
	iframe.src = src;
	iframe.style.position = "absolute";
	iframe.style.top = "0";
	iframe.style.left = "0";
	iframe.width = "100%";
	iframe.height = "100%";
	iframe.frameBorder = "0";
	iframe.style.pointerEvents = "auto";
	iframe.style.opacity = "0";
	iframe.allow = "autoplay; fullscreen; picture-in-picture";
	div.appendChild(iframe);
	const player = new Vimeo.Player(iframe);
	return { player, iframe };
}

function removeVimeoPlayerFromFullscreenDiv() {
	const div = getFullscreenDiv();
	if (!div) return;
	const iframes = div.querySelectorAll("iframe");
	for (const iframe of iframes) {
		iframe.remove();
	}
}

function isIOS() {
	return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

(() => {
	function init() {
		addFullscreenDiv();
		observeStackedPageContainers();
		console.log("v5.4");
	}
	// DOMContentLoaded가 이미 끝났으면 바로 실행
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();

function getVimeoIdFromSrc(src) {
	return src.split("/video/")[1].split("?")[0];
}
