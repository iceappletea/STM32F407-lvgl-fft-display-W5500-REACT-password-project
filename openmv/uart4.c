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
