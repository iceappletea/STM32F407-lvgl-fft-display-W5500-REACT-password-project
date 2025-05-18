# STM32F407 + LVGL FFT Display with W5500 Ethernet and React Password Web Interface

## Project Overview | 專案簡介

本專案為 [LVGL FFT Display](https://github.com/iceappletea/lvgl-fft-display) 的延伸版本，除了原有的 STM32F407ZGT6 + LVGL 即時波形與 FFT 頻譜圖顯示功能外，新增以下功能：

- **整合 W5500 硬體乙太網路模組**
- **透過 TCP 傳送 FFT 結果與波形資料**
- **提供 React 撰寫的網頁前端可視化介面**
- **新增密碼驗證機制，需驗證後方可查看 FFT 頻譜圖**

---

## Hardware Platform | 硬體平台

- MCU：STM32F407ZGT6
- 顯示：觸摸螢幕 + LVGL 圖形介面
- 網路：W5500 Ethernet 模組（SPI 通訊）
- 其他：電源、接地、網路線、麥克風

---

## Folder Structure | 專案架構簡介

| 資料夾 / 檔案     | 說明 |
|-------------------|------|
| `DSP_LIB/`        | FFT 與數位訊號處理演算法 |
| `Drivers/`        | STM32 HAL 驅動程式 |
| `NetAssist/`      | TCP 伺服端收發測試程式（Windows） |
| `Projects/`       | Keil 工程檔案與主程式 |
| `User/`           | 使用者撰寫邏輯、LVGL 畫面定義 |
| `W5500/`          | W5500 驅動程式與網路堆疊 |
| `my-react-app/`   | 前端 React 專案目錄 |
| `tcp/`            | TCP socket 連線範例與驗證流程 |
| `openmv/`         | OpenMV 模組（辨識密碼文字） |

---

## Functional Description | 系統功能描述

- 使用 **LVGL 繪製即時正弦波與 FFT 頻譜圖**
- 將結果透過 W5500 傳送至網頁前端
- 系統需先通過密碼驗證後，方可載入資料並計算與顯示

---

## 密碼驗證流程

### 🔸 步驟1. poll + debug

```c
// 確認 SR/DR 是否有資料
#include <stdio.h>
#include "uart4.h"

UART_HandleTypeDef huart4;

static void uart4_gpio_init(void)
{
	__HAL_RCC_GPIOC_CLK_ENABLE();
	__HAL_RCC_UART4_CLK_ENABLE();

	GPIO_InitTypeDef GPIO_InitStructure = { 0 };
	GPIO_InitStructure.Mode = GPIO_MODE_AF_PP;
	GPIO_InitStructure.Pull = GPIO_PULLUP;
	GPIO_InitStructure.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
	GPIO_InitStructure.Alternate = GPIO_AF8_UART4;
	GPIO_InitStructure.Pin = GPIO_PIN_10 | GPIO_PIN_11;
	HAL_GPIO_Init(GPIOC, &GPIO_InitStructure);
}

void uart4_init(uint32_t baud)
{
	uart4_gpio_init();

	huart4.Instance = UART4;
	huart4.Init.BaudRate = baud;
	huart4.Init.WordLength = UART_WORDLENGTH_8B;
	huart4.Init.StopBits = UART_STOPBITS_1;
	huart4.Init.Parity = UART_PARITY_NONE;
	huart4.Init.HwFlowCtl = UART_HWCONTROL_NONE;
	huart4.Init.Mode = UART_MODE_TX_RX;
	HAL_UART_Init(&huart4);
}

void uart4_poll_dbg(void)
{
	uint32_t sr;
	sr = huart4.Instance->SR;

	if (sr & (USART_SR_RXNE | USART_SR_ORE))
	{
		uint8_t ch;
		ch = huart4.Instance->DR;

		printf("SR=%08lX  CH=%02X '%c'\r\n", sr, ch, ch);
	}
}

```


```c
// 主程式循環測試
	uart4_init(115200);

	while (1)
	{
		uart4_poll_dbg();
	}
}

```

---

### 🔸 步驟2. poll (MASK 法)

```c
// 用 7 bit mask 判斷 plate_ok
#include <stdio.h>
#include "uart4.h"

UART_HandleTypeDef huart4;
volatile uint8_t plate_ok = 0;

static uint8_t plate_mask = 0;

#define MASK_A 0x01
#define MASK_1 0x02
#define MASK_8 0x04
#define MASK_B 0x08
#define MASK_3 0x10
#define MASK_0 0x20
#define MASK_5 0x40
#define TARGET_MASK 0x7F

static void uart4_gpio_init(void)
{
	__HAL_RCC_GPIOC_CLK_ENABLE();
	__HAL_RCC_UART4_CLK_ENABLE();

	GPIO_InitTypeDef GPIO_InitStructure = { 0 };
	GPIO_InitStructure.Mode = GPIO_MODE_AF_PP;
	GPIO_InitStructure.Pull = GPIO_PULLUP;
	GPIO_InitStructure.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
	GPIO_InitStructure.Alternate = GPIO_AF8_UART4;
	GPIO_InitStructure.Pin = GPIO_PIN_10 | GPIO_PIN_11;
	HAL_GPIO_Init(GPIOC, &GPIO_InitStructure);
}

void uart4_init(uint32_t baud)
{
	uart4_gpio_init();

	huart4.Instance = UART4;
	huart4.Init.BaudRate = baud;
	huart4.Init.WordLength = UART_WORDLENGTH_8B;
	huart4.Init.StopBits = UART_STOPBITS_1;
	huart4.Init.Parity = UART_PARITY_NONE;
	huart4.Init.HwFlowCtl = UART_HWCONTROL_NONE;
	huart4.Init.Mode = UART_MODE_TX_RX;
	HAL_UART_Init(&huart4);
}

void uart4_poll(void)
{
	uint32_t sr;

	while ((sr = UART4->SR) & (USART_SR_RXNE | USART_SR_ORE))
	{
		uint8_t ch;
		ch = UART4->DR;

		if (!(sr & USART_SR_ORE))
		{
			switch (ch)
			{
				case 'A':
					plate_mask |= MASK_A;
					break;
				case '1':
					plate_mask |= MASK_1;
					break;
				case '8':
					plate_mask |= MASK_8;
					break;
				case 'B':
					plate_mask |= MASK_B;
					break;
				case '3':
					plate_mask |= MASK_3;
					break;
				case '0':
					plate_mask |= MASK_0;
					break;
				case '5':
					plate_mask |= MASK_5;
					break;
			}

			if (plate_mask == TARGET_MASK)
			{
				plate_ok = 1;
			}
		}
	}
}

```


```c
// 主循環
	uart4_init(115200);

	while (1)
	{
		uart4_poll();

		if (plate_ok && !ui_ready)
		{
			lv_mainstart_init();
			ui_ready = 1;
		}

		if (ui_ready)
		{
			lv_task_handler();

			if (fft_ready && getSn_SR(SOCK_TCPC) == SOCK_ESTABLISHED)
			{
				char fft_msg[64];
				sprintf(fft_msg, "freq=%.2fHz, amp=%.2f\r\n", fft_max_freq, fft_max_val);
				send(SOCK_TCPC, (uint8_t *)fft_msg, strlen(fft_msg));
				fft_ready = 0;
			}
		}

		delay_ms(5);
		do_tcp_client();
	}
}

```

---

### 🔸 步驟3. 中斷 (MASK 法)

```c
// 把 uart4_poll() 內容搬到 UART4_IRQHandler()，一定要在 uart4_init() 裡開 RXNE 中斷並設定 NVIC
#include <stdio.h>
#include "uart4.h"

UART_HandleTypeDef huart4;
volatile uint8_t plate_ok = 0;

static uint8_t plate_mask = 0;

#define MASK_A 0x01
#define MASK_1 0x02
#define MASK_8 0x04
#define MASK_B 0x08
#define MASK_3 0x10
#define MASK_0 0x20
#define MASK_5 0x40
#define TARGET_MASK 0x7F

static void uart4_gpio_init(void)
{
	__HAL_RCC_GPIOC_CLK_ENABLE();
	__HAL_RCC_UART4_CLK_ENABLE();

	GPIO_InitTypeDef GPIO_InitStructure = { 0 };
	GPIO_InitStructure.Mode = GPIO_MODE_AF_PP;
	GPIO_InitStructure.Pull = GPIO_PULLUP;
	GPIO_InitStructure.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
	GPIO_InitStructure.Alternate = GPIO_AF8_UART4;
	GPIO_InitStructure.Pin = GPIO_PIN_10 | GPIO_PIN_11;
	HAL_GPIO_Init(GPIOC, &GPIO_InitStructure);
}

void uart4_init(uint32_t baud)
{
	uart4_gpio_init();

	huart4.Instance = UART4;
	huart4.Init.BaudRate = baud;
	huart4.Init.WordLength = UART_WORDLENGTH_8B;
	huart4.Init.StopBits = UART_STOPBITS_1;
	huart4.Init.Parity = UART_PARITY_NONE;
	huart4.Init.HwFlowCtl = UART_HWCONTROL_NONE;
	huart4.Init.Mode = UART_MODE_TX_RX;
	HAL_UART_Init(&huart4);

	__HAL_UART_ENABLE_IT(&huart4, UART_IT_RXNE);
	HAL_NVIC_SetPriority(UART4_IRQn, 5, 0);
	HAL_NVIC_EnableIRQ(UART4_IRQn);
}

void UART4_IRQHandler(void)
{
	if (__HAL_UART_GET_FLAG(&huart4, UART_FLAG_RXNE))
	{
		uint8_t ch;
		ch = UART4->DR;

		switch (ch)
		{
			case 'A':
				plate_mask |= MASK_A;
				break;
			case '1':
				plate_mask |= MASK_1;
				break;
			case '8':
				plate_mask |= MASK_8;
				break;
			case 'B':
				plate_mask |= MASK_B;
				break;
			case '3':
				plate_mask |= MASK_3;
				break;
			case '0':
				plate_mask |= MASK_0;
				break;
			case '5':
				plate_mask |= MASK_5;
				break;
		}

		if (plate_mask == TARGET_MASK)
		{
			plate_ok = 1;
		}
	}
}

```


```c
// 主循環
	uart4_init(115200);

	while (1)
	{
		if (plate_ok && !ui_ready)
		{
			lv_mainstart_init();
			ui_ready = 1;
		}

		if (ui_ready)
		{
			lv_task_handler();

			if (fft_ready && getSn_SR(SOCK_TCPC) == SOCK_ESTABLISHED)
			{
				char fft_msg[64];
				sprintf(fft_msg, "freq=%.2fHz, amp=%.2f\r\n", fft_max_freq, fft_max_val);
				send(SOCK_TCPC, (uint8_t *)fft_msg, strlen(fft_msg));
				fft_ready = 0;
			}
		}

		delay_ms(5);
		do_tcp_client();
	}
}

```

---

### 🔸 步驟4. 中斷 (順序比對)

```c
// 密碼一定要按順序接收，只有接收到A18B305才對，如果是A18B503就不行
#include <stdio.h>
#include "uart4.h"

UART_HandleTypeDef huart4;
volatile uint8_t plate_ok = 0;
static const char plate_seq[] = "A18B305";
static uint8_t plate_idx = 0;

static void uart4_gpio_init(void)
{
	__HAL_RCC_GPIOC_CLK_ENABLE();
	__HAL_RCC_UART4_CLK_ENABLE();

	GPIO_InitTypeDef GPIO_InitStructure = { 0 };
	GPIO_InitStructure.Mode = GPIO_MODE_AF_PP;
	GPIO_InitStructure.Pull = GPIO_PULLUP;
	GPIO_InitStructure.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
	GPIO_InitStructure.Alternate = GPIO_AF8_UART4;
	GPIO_InitStructure.Pin = GPIO_PIN_10 | GPIO_PIN_11;
	HAL_GPIO_Init(GPIOC, &GPIO_InitStructure);
}

void uart4_init(uint32_t baud)
{
	uart4_gpio_init();

	huart4.Instance = UART4;
	huart4.Init.BaudRate = baud;
	huart4.Init.WordLength = UART_WORDLENGTH_8B;
	huart4.Init.StopBits = UART_STOPBITS_1;
	huart4.Init.Parity = UART_PARITY_NONE;
	huart4.Init.HwFlowCtl = UART_HWCONTROL_NONE;
	huart4.Init.Mode = UART_MODE_TX_RX;
	HAL_UART_Init(&huart4);

	__HAL_UART_ENABLE_IT(&huart4, UART_IT_RXNE);
	HAL_NVIC_SetPriority(UART4_IRQn, 5, 0);
	HAL_NVIC_EnableIRQ(UART4_IRQn);
}

void UART4_IRQHandler(void)
{
	uint32_t sr;
	sr = huart4.Instance->SR;

	if (sr & (USART_SR_RXNE | USART_SR_ORE))
	{
		uint8_t ch;
		ch = huart4.Instance->DR;

		if (ch == plate_seq[plate_idx])
		{
			plate_idx++;

			if (plate_idx == sizeof(plate_seq) - 1)
			{
				plate_ok = 1;
				plate_idx = 0;
			}
		}
	}
}

```


```c
// 主循環
	uart4_init(115200);

	while (1)
	{
		if (plate_ok && !ui_ready)
		{
			lv_mainstart_init();
			ui_ready = 1;
		}

		if (ui_ready)
		{
			lv_task_handler();

			if (fft_ready && getSn_SR(SOCK_TCPC) == SOCK_ESTABLISHED)
			{
				char fft_msg[64];
				sprintf(fft_msg, "freq=%.2fHz, amp=%.2f\r\n", fft_max_freq, fft_max_val);
				send(SOCK_TCPC, (uint8_t *)fft_msg, strlen(fft_msg));
				fft_ready = 0;
			}
		}

		delay_ms(5);
		do_tcp_client();
	}
}

```
