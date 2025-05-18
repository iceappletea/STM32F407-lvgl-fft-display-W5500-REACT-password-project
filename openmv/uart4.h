#ifndef _UART4_H
#define _UART4_H

#include "stm32f4xx_hal.h"

void uart4_init(uint32_t baud);
void uart4_poll(void);
void uart4_poll_dbg(void);

extern UART_HandleTypeDef huart4;
extern volatile uint8_t plate_ok;

#endif
