---
type: paper-note
created: 2026-07-07 09:13
tags:
  - paper
  - RFID
  - range-detection
  - C1G2
  - algorithm
---
# Time-efficient Range Detection in Commodity RFID Systems

## 论文信息

- 标题：Time-efficient Range Detection in Commodity RFID Systems
- 作者：Jia Liu, Xingyu Chen, Haisong Liu, Hualin Gong, Yanyan Wang, Lijun Chen
- 年份：2020
- PDF / 原文：[[RFID/入门资料2/Liu 等 - Time-efﬁcient Range Detection in Commodity RFID Systems.pdf]]
- 关键词：RFID, Range Detection, C1G2, Select, Query

## 研究问题

在商用 C1G2 RFID 系统中，如何快速判断是否存在某些标签，其用户数据 $d_i$ 落在给定范围内。

形式化地，标签集合为 $\Gamma=\{t_1,t_2,\dots,t_n\}$，每个标签 $t_i$ 存储一个正整数数据 $d_i$。范围检测只需要回答二值问题：是否存在目标标签，而不一定要收集所有目标标签的数据。

论文约束非常重要：

- 只能使用商用 RFID 设备；
- 不修改 MAC 协议；
- 不修改硬件；
- 主要利用 C1G2 标准中已有的 Select 和 Query 能力。

## 基线方法：Exclusive Collection

### 原理

直接执行标准盘点：读写器通过 inventory frame 逐个读出标签 ID 和用户数据，然后检查 $d_i$ 是否在范围内。

C1G2 盘点帧中的时隙分为：

- singleton slot：只有一个标签回复，可成功读取；
- collision slot：多个标签回复，冲突，不能直接读取；
- empty slot：无标签回复。

### 问题

如果标签数很大，但目标标签很少，那么逐个收集数据非常浪费。范围检测本质上只需要 yes/no，不需要完整收集所有数据。

## 核心算法 1：SQ（Selective Query）

### 基本思想

如果多个标签具有相同数据值 $d$，则只需要读取其中一个标签的数据；若该数据不在目标范围内，就利用 Select 命令把所有数据等于 $d$ 的标签静默掉，后续不再参与 Query。

也就是说，SQ 把读取次数从“标签数 $n$”降低为“不同数据值的组数 $k$”。

### C1G2 命令基础

#### Select

Select 通过以下字段选择标签：

- MemBank：选择内存区。用户数据通常在 MemBank-3。
- Pointer：匹配起始位置。
- Length：Mask 长度。
- Mask：匹配字符串。
- Target：操作 SL 或某个 session 的 inventoried flag。
- Action：匹配和不匹配标签的 flag 如何变化。

论文主要使用 session 2 的 inventoried flag，取值 A/B。

常用动作：

- **AB**：匹配标签置 A，不匹配标签置 B。
- **A-**：匹配标签置 A，不匹配标签不变。
- **B-**：匹配标签置 B，不匹配标签不变。

#### Query

Query 发起盘点帧，只让指定 session 中 flag 为 A 或 B 的标签回复。例如 $Q(0,2,0)$ 表示盘点 session 2 中 flag=A 的标签。

### SQ 流程

1. 初始化：读写器发送 Select，把覆盖范围内所有标签的 inventoried flag 置为 A。
2. 当仍有 A 标签时：
   1. 执行 Query，只盘点 A 标签。
   2. 从一个成功时隙读取某个标签的数据 $d'$。
   3. 如果 $d'$ 在目标范围内，则检测成功，返回 yes。
   4. 否则发送 Select，使用 mask=$d'$，Action=B-，把所有数据等于 $d'$ 的标签置为 B。
3. 若所有标签都被静默且未发现目标，则返回 no。

### 伪代码理解

```text
Select: all tags -> A
while exists active tag A:
    Query active tags
    read one value d'
    if d' in range:
        return yes
    else:
        Select(mask=d', action=B-)  # silence all tags with this value
return no
```

### 时间开销

若没有目标标签，需要遍历所有 $k$ 个不同数据组：

$$
T^*=t_s+k(t_q+t_s)
$$

其中：

- $t_s$：一次 Select 的时间；
- $t_q$：一次 Query + inventory frame 的时间；
- $k$：不同数据值组数。

如果数据重复度高，即 $k \ll n$，SQ 能显著优于逐个读取。但如果每个标签数据都不同，$k \approx n$，SQ 会退化。

## 核心算法 2：RQ（Range Query）

### 基本思想

范围检测只需判断是否存在目标标签。因此 RQ 不再逐组读取数据，而是先用若干 Select 命令把目标范围内的标签全部激活，把其他标签静默；最后只执行一次 Query。

若最后 Query 中有任何标签回复，则返回 yes；否则返回 no。

核心挑战是：如何用尽量少的 Select 命令表示一个数值范围。

## LRQ：检测是否存在 $d_i \le \tau$

### 朴素做法

对 $1,2,\dots,\tau$ 每个值分别发 Select，逐个激活这些值对应的标签，最后 Query 一次。

问题：需要 $\tau$ 次 Select，$\tau$ 大时很慢。

### 改进思想：用二进制前缀批量选择区间

如果 $\tau=2^x-1$，则 $[1,\tau]$ 中的数在固定长度二进制表示中有共同前缀：高位全为 0。因此可用一个 mask 一次选中整个区间。

例如在长度 $l'$ 的二进制域中，$2^x-1$ 形如：

```text
00...00 11...11
```

只匹配左侧 $l'-x$ 个 0，就能选择所有小于等于 $2^x-1$ 的值。

对任意 $\tau$，算法把 $[1,\tau]$ 拆成若干可以用前缀 mask 表示的连续子区间。

### 示例：$\tau=43$

$43$ 的二进制为：

```text
00101011
```

它可以拆成：

1. $[1,31]$：mask `000`
2. $[32,39]$：mask `00100`
3. $[40,43]$：mask `001010`

因此只需要 3 次 Select，而不是 43 次。

### 算法定义

设：

- $R(\tau)=\{r_i\}$：$\tau$ 的二进制表示中所有 1 的位置集合，从右往左编号，最低位为 0；
- $d(\tau)$：最右侧连续 1 的个数。

LRQ 需要的 Select 数量为：

$$
f(\tau)=|R(\tau)|-d(\tau)+1
$$

因为 $|R(\tau)| \le \lceil \log_2 \tau \rceil$，所以 Select 数从 $O(\tau)$ 降到 $O(\log \tau)$。

例如 $\tau=5000$ 时，论文给出的 $f(5000)=6$，远小于 5000。

### LRQ 流程

1. 根据 $\tau$ 的二进制表示构造若干 mask。
2. 第一个 Select 使用 Action=AB，把第一个子区间内标签置 A，其他置 B。
3. 后续 Select 使用 Action=A-，增量激活其他子区间标签，不改变已有 A 标签。
4. 执行一次 Query，只盘点 flag=A 的标签。
5. 有回复则返回 yes；无回复则返回 no。

### 时间开销

如果一个 Select 可包含 $\omega$ 个 mask，则：

$$
T(\tau)=\left\lceil\frac{f(\tau)}{\omega}\right\rceil t_s+t_q
$$

其中 $t_q$ 是最后一次 Query + inventory frame 的时间。

## URQ：检测是否存在 $d_i > \tau_U$

URQ 与 LRQ 对称，只需反转 Select 动作：

- LRQ 中的 AB 换成 BA；
- LRQ 中的 A- 换成 B-。

这样可把大于上界的标签置为 A，其余置为 B，最后 Query-A 即可。

## LURQ：检测是否存在 $\tau_L < d_i \le \tau_U$

LURQ 通过两次范围选择实现：

1. 执行 LRQ($\tau_U$) 的选择部分，但不 Query：把 $[1,\tau_U]$ 置 A，其他置 B。
2. 再对 $[1,\tau_L]$ 执行选择，但 Action 使用 B-：把小于等于下界的标签置 B。
3. 此时只有 $(\tau_L,\tau_U]$ 内标签仍为 A。
4. 最后 Query-A，有回复则 yes。

时间开销：

$$
T(\tau_L,\tau_U)=\left\lceil\frac{f(\tau_L)+f(\tau_U)}{\omega}\right\rceil t_s+t_q
$$

## Mask Combination

一些商用读写器允许一个 Select 命令携带多个 mask。例如论文实验中：

- Impinj R420 最多支持 2 个 mask，但只暴露字符级 mask；
- Alien ALR 9900+ / ALR F800 支持最多 4 个 mask，并支持 bit-level mask。

因此多个逻辑 Select 可合并为一个物理 Select，进一步降低开销。

## 算法贡献总结

这篇论文的关键不是提出新的 RFID 物理层协议，而是重新组合 C1G2 标准已有命令：

1. **Exclusive Collection**：逐个读，正确但慢。
2. **SQ**：按“数据值组”读，每个不同值只读一次。
3. **RQ**：不读具体值，直接用 Select 构造范围，最后只 Query 一次。

RQ 的核心算法思想是把数值范围分解成少量二进制前缀区间，用 Select 的 mask 语义批量选择目标标签。这类似数据库 / 路由中的前缀覆盖：用少量前缀表示一个连续范围。

## 实验与结果

- 实验使用商用 UHF RFID 读写器和标签，场景为图书馆环境，最多 1000 个商用标签。
- 论文发现 bit-level mask 对 RQ 很关键；最终采用 Alien ALN-F800 进行实验。
- 摘要中报告：RQ 相比基线可获得接近 30× 的时间效率提升。

## 和我的课题的关系

- 可借鉴：
  - 不修改硬件和 MAC，仅靠 C1G2 Select/Query 实现高级查询。
  - 把 yes/no 检测问题转化为“先选择目标集合，再一次 Query 判空”。
  - 用二进制前缀覆盖减少范围选择命令数。
- 可质疑：
  - 需要读写器支持 bit-level mask；部分读写器虽然标准允许，但 API 未必开放。
  - 数据必须以可比较整数形式存储在标签用户区，并且编码长度、位置需要预先约定。
  - 如果目标标签很多，最后 Query 可能出现大量碰撞；不过对 yes/no 检测而言，只要能观察到有回复或能检测能量 / 碰撞即可。
- 可延展：
  - 多维范围检测：温度 + 湿度等多个字段可否用多个 Select 组合实现。
  - 与分组协议结合：先用 RQ 找出范围内标签，再给目标标签写入临时 group ID。
  - 对非连续集合，可借鉴前缀覆盖思想做集合压缩。

## 疑问清单

- [ ] 最后一次 Query 是否必须成功读出单个标签，还是只要检测到任意响应 / 碰撞即可判断存在？不同商用读写器支持程度如何？
- [ ] 当目标集合很大时，Query 帧长度如何设置才能最短地判断“存在”？
- [ ] 论文中的 mask combination 是读写器厂商扩展还是 C1G2 标准层面能力？
- [ ] 对温度这类动态传感数据，标签用户区数据更新与 Select 查询之间是否存在一致性问题？

## 相关笔记

- [[RFID/入门资料2/C1G2读书笔记]]
- [[RFID/入门资料2/论文阅读笔记/Fast RFID Grouping Protocols]]
